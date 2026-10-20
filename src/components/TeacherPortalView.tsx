import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ControlDefinition } from '../data/controls';
import {
  AuthorizedTeacherRecord,
  getApiBaseUrl,
  teacherApi,
  TeacherApiError,
  VerifiedTeacherUser,
} from '../services/teacherApi';
import { PrintableControlsView } from './PrintableControlsView';

const TOKEN_STORAGE_KEY = 'ies_orienteering_teacher_token_v1';

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      width?: number;
    }
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

export const TeacherPortalView: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<VerifiedTeacherUser | null>(null);
  const [controls, setControls] = useState<ControlDefinition[]>([]);
  const [teachers, setTeachers] = useState<AuthorizedTeacherRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'TEACHERS'>('CONTROLS');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<{
    title: string;
    message: string;
    attemptedEmail?: string;
  } | null>(null);

  const [allowDevAuth, setAllowDevAuth] = useState<boolean>(false);
  const [devEmailInput, setDevEmailInput] = useState<string>(
    'profesor@iessierraalmijara.es'
  );

  // Teacher email management form state
  const [newTeacherEmail, setNewTeacherEmail] = useState<string>('');
  const [managementFeedback, setManagementFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState<boolean>(false);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();

  const clearSession = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    setControls([]);
    setTeachers([]);
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const loadAuthorizedPortalData = useCallback(
    async (activeToken: string) => {
      setIsLoading(true);
      setAuthError(null);
      try {
        const [sessionRes, controlsList, teachersList] = await Promise.all([
          teacherApi.verifySession(activeToken),
          teacherApi.getControls(activeToken),
          teacherApi.listTeachers(activeToken),
        ]);

        setCurrentUser(sessionRes.user);
        setControls(controlsList);
        setTeachers(teachersList);
        setToken(activeToken);
        try {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, activeToken);
        } catch {
          // ignore
        }
      } catch (err) {
        clearSession();
        if (err instanceof TeacherApiError) {
          if (err.status === 403) {
            setAuthError({
              title: '⛔ Acceso Restringido (Correo no autorizado)',
              message: err.message,
              attemptedEmail: err.attemptedEmail,
            });
          } else {
            setAuthError({
              title: '⚠️ Error de Autenticación',
              message: err.message,
            });
          }
        } else {
          setAuthError({
            title: '⚠️ Error de Conexión',
            message: 'No se pudo verificar el acceso con el servidor.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [clearSession]
  );

  // Check backend health & dev auth availability on mount
  useEffect(() => {
    teacherApi
      .checkHealth()
      .then((res) => {
        setAllowDevAuth(Boolean(res.allowDevAuth));
      })
      .catch(() => {
        // Ignore if backend is offline initially; error will show when logging in
      });
  }, []);

  // Restore session if token exists in sessionStorage
  useEffect(() => {
    if (token && !currentUser) {
      loadAuthorizedPortalData(token);
    }
  }, [token, currentUser, loadAuthorizedPortalData]);

  // Load Google Identity Services script if VITE_GOOGLE_CLIENT_ID is provided
  useEffect(() => {
    if (currentUser || !googleClientId) return;

    const initializeGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (response.credential) {
            loadAuthorizedPortalData(response.credential);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 300,
      });
    };

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existingScript) {
      initializeGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleButton;
    document.head.appendChild(script);
  }, [currentUser, googleClientId, loadAuthorizedPortalData]);

  const handleDevLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = devEmailInput.trim().toLowerCase();
    if (!cleaned) return;
    loadAuthorizedPortalData(`dev:${cleaned}`);
  };

  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTeacherEmail.trim()) return;

    setIsSubmittingEmail(true);
    setManagementFeedback(null);
    try {
      await teacherApi.addTeacher(token, newTeacherEmail.trim());
      const updated = await teacherApi.listTeachers(token);
      setTeachers(updated);
      setNewTeacherEmail('');
      setManagementFeedback({
        type: 'success',
        text: `✅ Correo «${newTeacherEmail.trim().toLowerCase()}» añadido a la base de datos de autorizados.`,
      });
    } catch (err) {
      setManagementFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo añadir el correo autorizado.',
      });
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleRemoveTeacher = async (emailToRemove: string) => {
    if (!token) return;
    setManagementFeedback(null);
    try {
      await teacherApi.removeTeacher(token, emailToRemove);
      const updated = await teacherApi.listTeachers(token);
      setTeachers(updated);
      setManagementFeedback({
        type: 'success',
        text: `🗑️ Acceso revocado para «${emailToRemove}».`,
      });
    } catch (err) {
      setManagementFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo eliminar el correo seleccionado.',
      });
    }
  };

  // 1. UNAUTHENTICATED VIEW (GOOGLE LOGIN GATE)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4">
        <header className="max-w-lg w-full mx-auto pt-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-orange-400 block">
              IES SIERRA ALMIJARA · DEPARTAMENTO DE E.F.
            </span>
            <h1 className="text-2xl font-black tracking-tight">
              🔒 Portal del Profesorado
            </h1>
          </div>
          <a
            href="/ies-orienteering/"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200"
          >
            ← App Alumnos
          </a>
        </header>

        <main className="max-w-lg w-full mx-auto my-auto py-8">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border-2 border-orange-500 text-orange-400 flex items-center justify-center text-3xl mx-auto mb-3">
                🧭
              </div>
              <h2 className="text-2xl font-black text-white">
                Gestión de Balizas QR y Accesos
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Los códigos QR oficiales y las claves manuales de las 22 balizas están
                protegidos. Inicia sesión con tu cuenta de <strong>Google</strong>{' '}
                autorizada para verlos, imprimirlos o gestionar permisos.
              </p>
            </div>

            {authError && (
              <div className="p-4 rounded-2xl bg-red-950/90 border-2 border-red-500 text-red-100 space-y-1.5">
                <p className="font-black text-base text-red-300">{authError.title}</p>
                <p className="text-sm font-medium">{authError.message}</p>
                {authError.attemptedEmail && (
                  <p className="text-xs text-red-300/90 pt-1">
                    Pide a un profesor ya autorizado que agregue{' '}
                    <span className="font-mono font-bold underline">
                      {authError.attemptedEmail}
                    </span>{' '}
                    en la pestaña «Profesores Autorizados».
                  </p>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-300">
                  Verificando credenciales y permisos en la base de datos...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Official Google Sign-In Button */}
                <div className="flex flex-col items-center justify-center space-y-3">
                  {googleClientId ? (
                    <div ref={googleButtonRef} className="min-h-[44px]" />
                  ) : (
                    <div className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                      Para mostrar el botón oficial de Google en producción, configura{' '}
                      <code className="text-orange-300 font-mono">
                        VITE_GOOGLE_CLIENT_ID
                      </code>
                      .
                    </div>
                  )}
                </div>

                {/* Local / Demo Google Sign-In Simulator (only when backend enables allowDevAuth) */}
                {allowDevAuth && (
                  <form
                    onSubmit={handleDevLoginSubmit}
                    className="pt-5 border-t border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                        🧪 Acceso Google (Modo Desarrollo / Demo Local)
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        API: {getApiBaseUrl()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Simula el inicio de sesión con Google introduciendo un correo para
                      comprobar la validación contra el repositorio de la base de datos:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        value={devEmailInput}
                        onChange={(e) => setDevEmailInput(e.target.value)}
                        placeholder="correo@iessierraalmijara.es"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border-2 border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-black text-sm shrink-0 shadow"
                      >
                        Entrar con Google
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDevEmailInput('profesor@iessierraalmijara.es')
                        }
                        className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-mono"
                      >
                        ✓ Usar email autorizado (profesor@...)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDevEmailInput('alumno.curioso@gmail.com')}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-800 text-red-300 font-mono"
                      >
                        ✕ Probar email NO autorizado (alumno...)
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </main>

        <footer className="max-w-lg w-full mx-auto text-center text-xs text-slate-500 pb-4">
          IES Sierra Almijara · Portal Protegido con Clean Architecture & Google Auth
        </footer>
      </div>
    );
  }

  // 2. AUTHENTICATED TEACHER PORTAL VIEW
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      {/* Top Navigation Bar (Hidden when printing A4 cards) */}
      <header className="no-print sticky top-0 z-30 bg-slate-900 text-white border-b-4 border-orange-500 px-4 py-3.5 shadow-lg">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-orange-400">
              IES SIERRA ALMIJARA · PORTAL DEL PROFESORADO
            </p>
            <h1 className="text-lg sm:text-xl font-black">
              Gestión de Balizas QR y Profesores Autorizados
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs">
              <span className="text-emerald-400 font-bold">● Autorizado:</span>{' '}
              <span className="font-mono text-slate-100">{currentUser.email}</span>
            </div>

            <a
              href="/ies-orienteering/"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-bold text-xs sm:text-sm"
            >
              ← App Alumnos
            </a>

            <button
              type="button"
              onClick={clearSession}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-5xl mx-auto mt-3 pt-3 border-t border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('CONTROLS')}
            className={`px-4 py-2 rounded-xl font-black text-sm transition ${
              activeTab === 'CONTROLS'
                ? 'bg-orange-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            🖨️ Balizas Oficiales QR ({controls.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TEACHERS')}
            className={`px-4 py-2 rounded-xl font-black text-sm transition ${
              activeTab === 'TEACHERS'
                ? 'bg-orange-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            👥 Profesores Autorizados ({teachers.length})
          </button>
        </div>
      </header>

      {/* Tab 1: Printable A4 QR Controls */}
      {activeTab === 'CONTROLS' && <PrintableControlsView controls={controls} />}

      {/* Tab 2: Authorized Teachers Database Management */}
      {activeTab === 'TEACHERS' && (
        <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
          <section className="bg-white rounded-2xl border-2 border-slate-300 p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Añadir Profesor Autorizado
              </h2>
              <p className="text-sm text-slate-600">
                Introduce la cuenta de correo de Google (Gmail o corporativa) del
                profesor para permitirle iniciar sesión y acceder a los códigos QR.
              </p>
            </div>

            <form
              onSubmit={handleAddTeacherSubmit}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                required
                value={newTeacherEmail}
                onChange={(e) => setNewTeacherEmail(e.target.value)}
                placeholder="nuevo.profesor@iessierraalmijara.es"
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-300 font-mono text-sm focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={isSubmittingEmail}
                className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-sm shrink-0 disabled:opacity-50"
              >
                {isSubmittingEmail ? 'Guardando...' : '+ Autorizar Email'}
              </button>
            </form>

            {managementFeedback && (
              <div
                className={`p-3.5 rounded-xl text-sm font-bold border ${
                  managementFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                    : 'bg-red-50 border-red-400 text-red-900'
                }`}
              >
                {managementFeedback.text}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border-2 border-slate-300 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Lista Blanca de Correos en Base de Datos
                </h2>
                <p className="text-sm text-slate-600">
                  Únicamente los correos de esta tabla pueden iniciar sesión con Google
                  en este portal.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-800 font-mono font-bold text-xs">
                Total: {teachers.length}
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase text-xs">
                    <th className="py-3 px-4">Correo Electrónico (Google)</th>
                    <th className="py-3 px-4">Añadido Por</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((item) => {
                    const isSelf = item.email === currentUser.email;
                    return (
                      <tr
                        key={item.email}
                        className="border-t border-slate-200 odd:bg-white even:bg-slate-50"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {item.email}{' '}
                          {isSelf && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-sans text-xs">
                              Tú
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                          {item.addedBy ?? 'sistema'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isSelf ? (
                            <span className="text-xs text-slate-400 italic">
                              Sesión activa
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveTeacher(item.email)}
                              className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs"
                            >
                              Revocar acceso
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
};
