export type ControlType = 'START' | 'CONTROL' | 'FINISH';

/**
 * Full control station definition returned ONLY by the authenticated Teacher Portal API
 * for rendering and printing the physical A4 cards.
 */
export interface ControlDefinition {
  id: string;          // '1'..'100' ('1' = START, '2'..'99' = CONTROL, '100' = FINISH)
  type: ControlType;
  label: string;       // 'SALIDA (1)', 'Baliza 2'..'Baliza 99', 'META (100)'
  cardTitle: string;   // 'SALIDA', 'BALIZA 2'..'BALIZA 99', 'META'
  qrPayload: string;   // Provided by authenticated teacher backend
  backupCode: string;  // Provided by authenticated teacher backend
}

/**
 * Public control metadata stored in the static offline PWA bundle.
 * Contains ONLY salted multi-round SHA-256 hashes (zero plaintext secret codes).
 */
export interface HashedControlDefinition {
  id: string;          // '1'..'100'
  type: ControlType;
  label: string;
  cardTitle: string;
  qrHash: string;      // Salted SHA-256 hash of normalized QR payload
  backupHash: string;  // Salted SHA-256 hash of normalized 3-char backup code
}

export const CONTROL_HASH_SALT = 'IES-SIERRA-ALMIJARA-ORI-2026-V2';
export const CONTROL_HASH_ROUNDS = 256;

// Pure TypeScript synchronous SHA-256 (FIPS 180-4) for 100% offline browser execution
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Hex(ascii: string): string {
  const bytes = new TextEncoder().encode(ascii);
  const bitLen = bytes.length * 8;
  const totalWords = (((bytes.length + 8) >>> 6) + 1) << 4;
  const words = new Uint32Array(totalWords);

  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i & 3) * 8);
  }
  words[bytes.length >>> 2] |= 0x80 << (24 - (bytes.length & 3) * 8);
  words[totalWords - 1] = bitLen >>> 0;
  words[totalWords - 2] = Math.floor(bitLen / 0x100000000) >>> 0;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalWords; offset += 16) {
    for (let i = 0; i < 16; i++) {
      w[i] = words[offset + i];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

export function hashControlSecret(rawInput: string): string {
  const cleaned = rawInput.trim().toUpperCase();
  let digest = sha256Hex(`${CONTROL_HASH_SALT}:${cleaned}`);
  for (let r = 1; r < CONTROL_HASH_ROUNDS; r++) {
    digest = sha256Hex(`${CONTROL_HASH_SALT}:${r}:${digest}`);
  }
  return digest;
}

export const OFFICIAL_CONTROLS: HashedControlDefinition[] = [
  { id: '1', type: 'START', label: 'SALIDA (1)', cardTitle: 'SALIDA', qrHash: 'dfefe014b5157c2b5840030d93788591261c550f915772beae354ca8efe82e82', backupHash: '7c2b3dcb613eac52d3a2ca2d51ee4a726d8d4d2dda489a79de17eca85223aaaa' },
  { id: '2', type: 'CONTROL', label: 'Baliza 2', cardTitle: 'BALIZA 2', qrHash: '29ae0f76a949853482d929e9c23c68f84edf82912e540d0379a5642f96956c23', backupHash: '66603dbe13849ead797fc3f5f24a937d8314c6624b5cbad2502e08e3b32a8afc' },
  { id: '3', type: 'CONTROL', label: 'Baliza 3', cardTitle: 'BALIZA 3', qrHash: 'f795c6e94aad7be58b222471383bee4e46fb20606b11d4e9f4858538aad1e979', backupHash: '8d115a6b15994b750d2d69a4018c2a9c763dae1101c74f42887bda2704bbadc7' },
  { id: '4', type: 'CONTROL', label: 'Baliza 4', cardTitle: 'BALIZA 4', qrHash: 'afd7310112b0e0abd1773c6185812507d029bbbb054d81b1b506123ab655e0bc', backupHash: '544582b3469a0f3d451811544318b2327833ac4791324eff84b27cba3a3b67bb' },
  { id: '5', type: 'CONTROL', label: 'Baliza 5', cardTitle: 'BALIZA 5', qrHash: '30afdb23b65bfad3d1ab9a9d7d164e40f6ecc3706e660b40b8fb0f9bf5c0dcb1', backupHash: '2e6d4203cc758f36713838d297f2c2635b38ccb6032d67765a090fc926b0fd53' },
  { id: '6', type: 'CONTROL', label: 'Baliza 6', cardTitle: 'BALIZA 6', qrHash: 'd4122d38309cacb0489ed87d77df6e84dba268cdb5f1469e390da6c4c652355a', backupHash: '3e43b06a8ad9cdb7167dcfeff837992efba4482beabe9a037375383a97119c89' },
  { id: '7', type: 'CONTROL', label: 'Baliza 7', cardTitle: 'BALIZA 7', qrHash: 'b1e07c7689d5e0addc67c02ae7bde93c1178eeac19d83639cd31c1c79a3013ba', backupHash: 'c884b3f01818e817d6d7d6b02c2e2f3e3b4c3c07ba9db9e31ab6c3b5b7a5e5d4' },
  { id: '8', type: 'CONTROL', label: 'Baliza 8', cardTitle: 'BALIZA 8', qrHash: 'f285d1ab37be09bb1c4abfe1cc13ab5cdfab0e1941f19056c8227be096bca5e9', backupHash: 'f04e7487ac8d1bc6b4f30e3f32e888b1dbdf26e9ff62e6d2ed2186029ea3b2ab' },
  { id: '9', type: 'CONTROL', label: 'Baliza 9', cardTitle: 'BALIZA 9', qrHash: '432e211e11d14972160384116a7449749767528af49dca2fd02d12b739d9c3a8', backupHash: '084ec12553fe83c5beca0f419827089f11685bb6e438c01d6801700c42505a62' },
  { id: '10', type: 'CONTROL', label: 'Baliza 10', cardTitle: 'BALIZA 10', qrHash: 'a8b20c5f6bd9c6afe9dd8cc3ba5740ec7c69bb348b6324c229cf2283d8872ee6', backupHash: '11a91743d4ee41c61f5364e09ec7cbe522b13fd0fefda5bb81d2188d0dad2ff8' },
  { id: '11', type: 'CONTROL', label: 'Baliza 11', cardTitle: 'BALIZA 11', qrHash: '49aad683884737cfc312cd65ee873bb80c464d548b18907077deb8355ec575ad', backupHash: '6a9515d6efa5cf9b1b470a7abfba6b1b7601a4f60c40afe2fb2d35896a7cd581' },
  { id: '12', type: 'CONTROL', label: 'Baliza 12', cardTitle: 'BALIZA 12', qrHash: '7e08cddcf81f532bcf89d9a714828fbe8847130958597ca561ef7821b9187e53', backupHash: '14bbaff408c8d17075c68982ab96e5ab3f9beb582f8d603e5cc0351c78fe2f3d' },
  { id: '13', type: 'CONTROL', label: 'Baliza 13', cardTitle: 'BALIZA 13', qrHash: '19b2af26153d77780c873baaea5966aa5065d067439413cb877455ef2f8ac750', backupHash: 'f79ecb52c209fe14d767bdcc49616afa8c0bbad8c35e0fa630690c44ab4f2fb4' },
  { id: '14', type: 'CONTROL', label: 'Baliza 14', cardTitle: 'BALIZA 14', qrHash: '67d0f505ca21d79ccbf108f239189d5bc3ef008bb03c6e8166a55c9fd886d9ed', backupHash: '3995981f24e94fe68f143ffcbc5709d9fe47d5de331161cc585348d7507d5d83' },
  { id: '15', type: 'CONTROL', label: 'Baliza 15', cardTitle: 'BALIZA 15', qrHash: '501eee364d2c8f64c31de4c6908cb6de83f157b61e96d44b8e9450215901928a', backupHash: '925d48670dc33de28b814220f80d3380e5a4a6b871f5a41fcce4b09751cc1edf' },
  { id: '16', type: 'CONTROL', label: 'Baliza 16', cardTitle: 'BALIZA 16', qrHash: 'cd2fef99a2c4924ca1e1ce1cef77d87ddbba5d8ee4eb3382ea83c896add2b1cc', backupHash: '14fce0392152961581bf539d14e11369f444bc119bc2dc3b5598d86d50ca9de1' },
  { id: '17', type: 'CONTROL', label: 'Baliza 17', cardTitle: 'BALIZA 17', qrHash: '43b4772e8cdc3fc0b2ec1c249c2219c85d96a6041b464bf56fae335ddb714d04', backupHash: 'ae5174b7c4bffb599c4f88d7e92007002e5f8e4924896903792e9d0b6f68d440' },
  { id: '18', type: 'CONTROL', label: 'Baliza 18', cardTitle: 'BALIZA 18', qrHash: '01868bbf1a44748208e8a67c9bcdc300392e16440bce4067e9c7af24a13e3404', backupHash: '8d843ff4a33c0be40e799654abe5624d175c280517f52c33b58356d0cd8e9854' },
  { id: '19', type: 'CONTROL', label: 'Baliza 19', cardTitle: 'BALIZA 19', qrHash: '2fc3d9eaf37460254402bfc84fba20a8fc7f3c2a7cc9359af7b82f945f97dd52', backupHash: 'bdff6052b415e1955baa92a6f44d690c0526dfb5c535571882385af3d13f7d4e' },
  { id: '20', type: 'CONTROL', label: 'Baliza 20', cardTitle: 'BALIZA 20', qrHash: 'fd04b2f21e2bb1da634e1a8eb2b03bf83f34023e6035adeefb47a3784909e67c', backupHash: '9cf22959d39682751a04f7d803d53346bb635c815155baafeeddff251ba130f2' },
  { id: '21', type: 'CONTROL', label: 'Baliza 21', cardTitle: 'BALIZA 21', qrHash: 'f44682fce8257923564e9ddd642fc476760c2cbbba731b072d95e62f3899ab4f', backupHash: 'a7ce4f01891dcafb161deed17ac68118f6fc457bb6304d9063af0d0fb283cfb0' },
  { id: '22', type: 'CONTROL', label: 'Baliza 22', cardTitle: 'BALIZA 22', qrHash: 'dfe52ec5513a7d2aa435b315bfc72806a93c059b82c79d4515605b69d34ee469', backupHash: '1bbf3552ac62ebb22fda5c9988eb9da16029f76be9377790a5eb94f479ef2a69' },
  { id: '23', type: 'CONTROL', label: 'Baliza 23', cardTitle: 'BALIZA 23', qrHash: '457f811044ed3904533f0c27aacef117d557f54517fa1c7b755f8d3ff48477a3', backupHash: '526c9e06ce0d3fd6d6752692e76198ca303932834219223ceafa4f7967731325' },
  { id: '24', type: 'CONTROL', label: 'Baliza 24', cardTitle: 'BALIZA 24', qrHash: 'e2027a9c416adef8919a32f92a372e385c0ebf7efcaef24168e75604a07560dd', backupHash: '266573195f84869206ec2a42a933844703689e0f167e121b156e2bc2db9231a7' },
  { id: '25', type: 'CONTROL', label: 'Baliza 25', cardTitle: 'BALIZA 25', qrHash: '56bfea977cd75ac84474916235a3b30d4099195e93573d92c10717ea309ac7d4', backupHash: 'cb88e942441a657788261845d75ae46445e48895071bbae97e36b72c336ca7bb' },
  { id: '26', type: 'CONTROL', label: 'Baliza 26', cardTitle: 'BALIZA 26', qrHash: '2520d3f875aafb1a66f1b1760ef56115a7c4e1e4f48cede6e89a15b41c317899', backupHash: '52f2717e294f3e19e732cb5ebfacf6d5c93dabf1bf4445c52b155642e62c4db3' },
  { id: '27', type: 'CONTROL', label: 'Baliza 27', cardTitle: 'BALIZA 27', qrHash: '97adc0f6291dfccf9fb95a22f5e2a5611594e5043718d85007b0ee7200b98151', backupHash: 'aa5020b7650fe362321c30e6b0d72709755499a952cb5eb209b4f003efb6a5f0' },
  { id: '28', type: 'CONTROL', label: 'Baliza 28', cardTitle: 'BALIZA 28', qrHash: '0a787e6bac3219f65002d8cdd0064d39886a34b4cca6c4580a422e0de442a4a9', backupHash: 'e215e0f69c8ebf893e1ab0fbb188be432bae66b7f7b8a454eb2b7728e0422ad1' },
  { id: '29', type: 'CONTROL', label: 'Baliza 29', cardTitle: 'BALIZA 29', qrHash: '70fe3e6460fe3a8a63fdaabad07ed0ec6bc7241dca41f16ac43da0131b86cec4', backupHash: '4369edaaf010c8752be0610b001ef3340123233b00d4be0e334b9d19c7008539' },
  { id: '30', type: 'CONTROL', label: 'Baliza 30', cardTitle: 'BALIZA 30', qrHash: '4683518287f5ab098f6f3d7987eccda23e50b947e884b4eefe7a636c006690b8', backupHash: '959d1acabc806d6336a6813de496db41bfa29ba6e1e4db10bc49a4dd67d414f1' },
  { id: '31', type: 'CONTROL', label: 'Baliza 31', cardTitle: 'BALIZA 31', qrHash: '29ba31c382f88d18ed8b93fd745761ddbc0f4c0727302e3aa25805995c164e01', backupHash: '84b8cbba083207d3b6800e0a387586cb08fbe4f5ac3c954635cec334f49e314d' },
  { id: '32', type: 'CONTROL', label: 'Baliza 32', cardTitle: 'BALIZA 32', qrHash: 'ee92c53906098f154b423cbbd8c50aabe37912855641566f58cdd0835a518b9c', backupHash: '3533702b579f1dba92c89c39dea63cc646938167a995a106215ad72dc004f196' },
  { id: '33', type: 'CONTROL', label: 'Baliza 33', cardTitle: 'BALIZA 33', qrHash: '24216f7a938ceaa5067e51e0e30039ed7540bbb73b3e5663b0159d3567684907', backupHash: 'c20684d55479ab4e109e18988937aec8910b8f2aec2a038bf1ce5f4207535af2' },
  { id: '34', type: 'CONTROL', label: 'Baliza 34', cardTitle: 'BALIZA 34', qrHash: 'fe617e2e3cacddc21ec75bce66b6d965df3c08557f639a79295514292e33bbe0', backupHash: '15e36f146f1df88074d593344b6515f7dd599b44a7941d0dd22ebd07919000ce' },
  { id: '35', type: 'CONTROL', label: 'Baliza 35', cardTitle: 'BALIZA 35', qrHash: '88261b85412392dbc2f810f0ecdea42dc26abdad77cb24aeba502909b08c557e', backupHash: '6a5993032da6231904a57fe4466bb3c8cdcf0a109edd8f2e9225c11a9e626698' },
  { id: '36', type: 'CONTROL', label: 'Baliza 36', cardTitle: 'BALIZA 36', qrHash: '0d218a580502564d4cbdae2f45dbb571e05f46a81d4eae6974916940e909055a', backupHash: '4f30e8974e2f7829a1c10eb97d97585e27fb88998ea1da43f3c0b3f05f17b3ed' },
  { id: '37', type: 'CONTROL', label: 'Baliza 37', cardTitle: 'BALIZA 37', qrHash: '820934a16cc43767a8ed0e1352d04070f2837af7f3e0b7c95e87ea275eb7995e', backupHash: '7734821c1971e38ed768385b483045b1bd604bd955629c43683ddc611f9ad89b' },
  { id: '38', type: 'CONTROL', label: 'Baliza 38', cardTitle: 'BALIZA 38', qrHash: 'afcafc0f7e2d89cb05fdfd045ff0c0d20d59f618fb8aa6c06c68a443a7c9bfcd', backupHash: '67c6e8006656fed248d62426f34e172aee6a93baab3e47c02edfb828936a2032' },
  { id: '39', type: 'CONTROL', label: 'Baliza 39', cardTitle: 'BALIZA 39', qrHash: '02b3e0898f00c2c3801a6091ceaf39c0184c63fa3602442b9d64187604751321', backupHash: '0dea8cccd3fd6655b275ceb652f17cdb32e482fcccb3a1c97fa570015b9dcba2' },
  { id: '40', type: 'CONTROL', label: 'Baliza 40', cardTitle: 'BALIZA 40', qrHash: '9a70e221d30906717fb2ab53bc82f6f60690c657ce51374d4db17d618d3b3aad', backupHash: 'a66cd357485727a02e41228aaedca677781411e428b16a3812829e3a5a72affd' },
  { id: '41', type: 'CONTROL', label: 'Baliza 41', cardTitle: 'BALIZA 41', qrHash: '64ee20f9fa616ee148e77a684b9aaf5f757c1a95df139dd39b2c5b95b86803dc', backupHash: '4fd363210c9c9ebbf045ce1368dff459c5a850428f8f2b36720c9c2238a99017' },
  { id: '42', type: 'CONTROL', label: 'Baliza 42', cardTitle: 'BALIZA 42', qrHash: '3fa6e0a12375e8ca1c5c2562e8f4a76bda5e4beff39466beadb1fefc97e7410d', backupHash: 'fe61aa3885ae164b26d1f8e228b1f1d3dbd8e74875f407aecef5e64cc13f4c30' },
  { id: '43', type: 'CONTROL', label: 'Baliza 43', cardTitle: 'BALIZA 43', qrHash: 'fa565c9e5dca4fb58431bab8c32685394e5ae52a9ed3664e2433b4024b5d961c', backupHash: '1437389da93b3c9ff2226535175ea06b07cc461b2c983667605b6d9388fc4d38' },
  { id: '44', type: 'CONTROL', label: 'Baliza 44', cardTitle: 'BALIZA 44', qrHash: '0f12a1f9e0ee6109bab928aa610b73cf6b2697dea7cab12736be649da87ec36d', backupHash: 'b4d82c25a883028eebb6242b14fb1f7b13b8280af4eaadb6db5b88afe84550af' },
  { id: '45', type: 'CONTROL', label: 'Baliza 45', cardTitle: 'BALIZA 45', qrHash: '11484bf2bdb785058fa557ed18d0d02367de9909db02d8cb3c1f851b1c292938', backupHash: '7dad5a9e51d0218d68ffffa9a7b8992e123f390887e5fd8e7c17e9305cd77f08' },
  { id: '46', type: 'CONTROL', label: 'Baliza 46', cardTitle: 'BALIZA 46', qrHash: 'e2165d87c93b034f8f541432fc640f601bea813eabec7594d4663e10bf0ca1ce', backupHash: '2c1cde1021d6f4983b86a74fcf0514c17b4680b6fafee42b3c39638c06ddfeab' },
  { id: '47', type: 'CONTROL', label: 'Baliza 47', cardTitle: 'BALIZA 47', qrHash: '28f3da4ccdebed1249ae6279b4a534e86c15023cadf1d6ca9bd4102d16bbd41d', backupHash: '98121a16906f5cbc7ecf900a7e12ddad0cb6089b675cdfcc6db746472c717f2b' },
  { id: '48', type: 'CONTROL', label: 'Baliza 48', cardTitle: 'BALIZA 48', qrHash: 'b9a6c9ac3cdc91e87074b9324a0f14cd5a8dfdcef6d10bdcc83c90c808d7c8c7', backupHash: '8c20237636956890f26f7980350d5b26772a93febf13e6ca61fb2f981399dd55' },
  { id: '49', type: 'CONTROL', label: 'Baliza 49', cardTitle: 'BALIZA 49', qrHash: 'f8ee52b06185c4b618460541e4e41939f50256395311500f0da42473e6467ec1', backupHash: 'c1eb2079894a04d77467dbf70e0c609c8dfc22ed064c7bbdc489119a8dcc017a' },
  { id: '50', type: 'CONTROL', label: 'Baliza 50', cardTitle: 'BALIZA 50', qrHash: '2c0c6f0fa94d90c047e30ade399dd09f482d65dbeb76de29749041d9e0dd9b72', backupHash: '0209359eefffb762403bf6fc5120e93af4c9a9764280d25b78770440c26167ba' },
  { id: '51', type: 'CONTROL', label: 'Baliza 51', cardTitle: 'BALIZA 51', qrHash: 'c18f3dd4c19c000883290fe5b07c238e7737cb215aae1a374857e5694b0cbe22', backupHash: 'a21d1dc0833ba2caf6b9d6238f53cfb6b3698a7071f0cb0f34539da4ae62d7a9' },
  { id: '52', type: 'CONTROL', label: 'Baliza 52', cardTitle: 'BALIZA 52', qrHash: '332e105a1b03d20d5da978f821b7d9fbe22dead8d9f744816f4c2282c6ce8258', backupHash: 'e06e4814cd0e6d739842e768f6223fddca98be9e18fc8d1de5459ff4ebe9ec58' },
  { id: '53', type: 'CONTROL', label: 'Baliza 53', cardTitle: 'BALIZA 53', qrHash: '77bea400d791ee01ed1b4bf6ecb9d22d5952e44b05c66b352671904f9d68eaa7', backupHash: '139b1f90977b23f68de6524241e61221e6bc4cdd83e3c1482fe4b349bdcd6b69' },
  { id: '54', type: 'CONTROL', label: 'Baliza 54', cardTitle: 'BALIZA 54', qrHash: '54258cc7ef0f82e7572824e8da194b4713c5fda92e89ba9e6ee87a7488fe8800', backupHash: '2b07571ef00f32e839c6a1f23c527def9ca99cc3f5ea1a564584f26486d72e98' },
  { id: '55', type: 'CONTROL', label: 'Baliza 55', cardTitle: 'BALIZA 55', qrHash: '2d84591467bf8546b1bfab181c5c65a04899b28b6143b9244152788e8a46e1fa', backupHash: 'aa4b1e8c9ceadba5c3b503b45302457fde943b6954386583cccf2c550978652a' },
  { id: '56', type: 'CONTROL', label: 'Baliza 56', cardTitle: 'BALIZA 56', qrHash: 'd064b1ad440c6ab95080d4d2264678bb8a8e1e61827864d666fcf4a6b6d30a85', backupHash: '9aeaea9ba3004442a6d16adf2d3e3f9e29b7dc05bc9dd299df0bbd9a83405fe5' },
  { id: '57', type: 'CONTROL', label: 'Baliza 57', cardTitle: 'BALIZA 57', qrHash: 'cfab2a0d2cdf50901a1c2d2f93b0dcd58f5ebcf782f9d90d104413c0303459d9', backupHash: 'd3ab7e66d427e6ee0af56043cd562e678801e4e8a2a6b27680e2d10223a26991' },
  { id: '58', type: 'CONTROL', label: 'Baliza 58', cardTitle: 'BALIZA 58', qrHash: '16b02392dc4caa5528532c8114ea38fedd6efd6d1d5c274bba92710621cc2eaf', backupHash: '90061d111087143e47c015bd74d1e5767c4fb52dbae6c21605fe4d91a1765d54' },
  { id: '59', type: 'CONTROL', label: 'Baliza 59', cardTitle: 'BALIZA 59', qrHash: 'a482603a715ed39a78f09e94391c24413ae416afc45ed424c460265998691a65', backupHash: 'd929926bec51fed9e1e37607156d5c632b54bcc0cb7883e03db3091c5868815c' },
  { id: '60', type: 'CONTROL', label: 'Baliza 60', cardTitle: 'BALIZA 60', qrHash: '59a52b9391fcf423df964bc120a6222672c6f91f2330f95acc26628c10ef92bb', backupHash: '71ac76cb8205a9c73cb296eeeb7df797ee27da8265ea87dec26282f0a1810682' },
  { id: '61', type: 'CONTROL', label: 'Baliza 61', cardTitle: 'BALIZA 61', qrHash: '94fa38507911c2c4b7b8a09bc56ac0caebfd701935851f7de0c8eb0ca7ebfbf4', backupHash: '28a0f559dd1536575bd85b1064c9dc0b74606b0a0fa712cc13e55d36121d0387' },
  { id: '62', type: 'CONTROL', label: 'Baliza 62', cardTitle: 'BALIZA 62', qrHash: '87c8fa43181b0fd582cf739e4614387ff8672e83c563e7e5957b606c5d399ef7', backupHash: 'de449b366ebba135a5ee536955291058107954a90d58fa75778d298d5b1ba175' },
  { id: '63', type: 'CONTROL', label: 'Baliza 63', cardTitle: 'BALIZA 63', qrHash: '00b6ac5cca2f9be4e3309ce1c4267b3e2cf317fe2cbc91ff87e0cbd6d697def5', backupHash: 'c72ff5092f1fbca8eec58d461f87c316f418ac30fbd866eaa6dafa73a0d9e861' },
  { id: '64', type: 'CONTROL', label: 'Baliza 64', cardTitle: 'BALIZA 64', qrHash: 'baa83eeb399c0884eb5f13df3377988390425ad8fb9614bd8e2d4e38fdf0ec4c', backupHash: 'a4498111c14fdf85cd16955a2dbd7a60f0dc1892099f8dace0148bfebb4268af' },
  { id: '65', type: 'CONTROL', label: 'Baliza 65', cardTitle: 'BALIZA 65', qrHash: 'c1616fcddc04dd5d921bb60603db4bd23aaca42283c7928bf719856b7b2af704', backupHash: '4377a9346bc8e2454e087dc680dc6d4a2d9c8acc350b2e5ae973dd591e6f48d3' },
  { id: '66', type: 'CONTROL', label: 'Baliza 66', cardTitle: 'BALIZA 66', qrHash: 'e20987f9d73f8e148df0a4f26dfde429b857b16bc9d6bda1125a461887739da7', backupHash: '3fdfeb96ac198bade92adf1508e6a21575f3ccdd7e78470f2504fe57f6e71349' },
  { id: '67', type: 'CONTROL', label: 'Baliza 67', cardTitle: 'BALIZA 67', qrHash: 'b76aba6ea66863f51b665dc19167aa5ccb9f6cb3a88c58853f1798880ed73f3a', backupHash: 'a48ca98f6cdc631ca007295bd60e2087a285263413c342b286744de0e3978c9d' },
  { id: '68', type: 'CONTROL', label: 'Baliza 68', cardTitle: 'BALIZA 68', qrHash: '8446c7656e978f21c5b68707de76ceb7147771812744d6def454f7594993bfaf', backupHash: 'dd7c353cec50efca2f017795f9ab8fbc0b353808b47653d9b29bf1dc85b790fc' },
  { id: '69', type: 'CONTROL', label: 'Baliza 69', cardTitle: 'BALIZA 69', qrHash: 'f9e139f04170ba5592c8809558e816b73fc5bfdd1ccd652a20fd8f29cfc7fff4', backupHash: 'cc0381cd34273b396e35028a6fbfd9d482307ae211bb3da306d19de77da0aa3c' },
  { id: '70', type: 'CONTROL', label: 'Baliza 70', cardTitle: 'BALIZA 70', qrHash: '207935f4f2fce01d4796d685d9a82ff1c4dbb76079f3072ea9eb6de6b2b8092f', backupHash: 'e4d546c842363f3870c7822a4a134742b9c637d2e7aab40a6c7792d0a6f8f0c5' },
  { id: '71', type: 'CONTROL', label: 'Baliza 71', cardTitle: 'BALIZA 71', qrHash: '398114025f4f304b4e36986707c8609b06b4a703eb4c9104ca8bf408606a7981', backupHash: '3df31469fe2e1cc1e5c4c3e8c10f48c1727e43d7bbd82e1a1241ff24a59dcd4e' },
  { id: '72', type: 'CONTROL', label: 'Baliza 72', cardTitle: 'BALIZA 72', qrHash: 'b987202f0ba19c92eb154a4236b571a33243c629b1c3a3ddb0c10e266b2b13f0', backupHash: '0cf87510226bafeba20b2a4e48d29c0e05d96a68ee816b744779838db22369cb' },
  { id: '73', type: 'CONTROL', label: 'Baliza 73', cardTitle: 'BALIZA 73', qrHash: 'c9ce1938b83137b18d7a0c92c4db8adde54ac7812ca72525ddc8187afcf3ec1a', backupHash: '740bde8cf9d63cf32b21023a1f7517905af24371b47df1e5c62ea907dd8043bb' },
  { id: '74', type: 'CONTROL', label: 'Baliza 74', cardTitle: 'BALIZA 74', qrHash: 'e2c1744416be77eda8584832198fcb3ba4add95847f0b8d879b7440f742c8ab8', backupHash: '0e02a89448d36fa43d9f04432c3a016ad04b0b0a1a793b43fb53f2a0e7d11612' },
  { id: '75', type: 'CONTROL', label: 'Baliza 75', cardTitle: 'BALIZA 75', qrHash: 'a71217926b432f6e83c7eb82704f671e29d1a25936a76102b778ea3f59f89a67', backupHash: '240a2719152c05d9b6ed6fb1ec49492998462aa95a409b4d3352c29b7cefcb3e' },
  { id: '76', type: 'CONTROL', label: 'Baliza 76', cardTitle: 'BALIZA 76', qrHash: 'f68e95ac47b41869ad58a7726fad6e9ed8e2e1e2eed55f1256caef0bae921dab', backupHash: '1ece820e5858a15a805a40adabd94e830760084f90c7660d4894c5ceaaf74c61' },
  { id: '77', type: 'CONTROL', label: 'Baliza 77', cardTitle: 'BALIZA 77', qrHash: 'eb7a07ea9936d56c44b68c650537785e066e301df06fc686e9f75c4472866dd6', backupHash: '0ee2588f19e64a19c4787b14f0b1e59c2cd2d029db686f0d75deb3786db7c2a4' },
  { id: '78', type: 'CONTROL', label: 'Baliza 78', cardTitle: 'BALIZA 78', qrHash: '2d47f045d313f842509323a074193eff80adaee38323f996ff540249e241283a', backupHash: '8a52d28af2113b59427a3019968293d4183b645181daa09758f173f62ea79a96' },
  { id: '79', type: 'CONTROL', label: 'Baliza 79', cardTitle: 'BALIZA 79', qrHash: 'e882f646da8ac01b78796ac7146ce37b672ede9f7b364d6808538401afa55812', backupHash: 'aa4079afa22300340b3b8b758b76e15ba5af6e732a37ce2d80fe90eac37eb3e8' },
  { id: '80', type: 'CONTROL', label: 'Baliza 80', cardTitle: 'BALIZA 80', qrHash: 'ea2e63e616ef0e0d254f63c847513dc4d2b818771588e2d6cd2da19235ffeb11', backupHash: '79656e4b448642610eef503de16b7282612704cdb29a594798152d81d35f218a' },
  { id: '81', type: 'CONTROL', label: 'Baliza 81', cardTitle: 'BALIZA 81', qrHash: '5a3996c912f17937bbc69176e273f36331e7529a5f105bbe2e5a153b48e52916', backupHash: '75c89a2ffd855cc30ed4e071bdfa7380ddd3f7c6369fcdb78fc3a0d9a46680ff' },
  { id: '82', type: 'CONTROL', label: 'Baliza 82', cardTitle: 'BALIZA 82', qrHash: 'd43d567e56656416d1f643a1831932c6d690a1aaa39638ca9119c6f09ef933c0', backupHash: 'f2b58fb2e580dbedf37c7fb45be638ddd24bfab407aec95018a939077156e0ba' },
  { id: '83', type: 'CONTROL', label: 'Baliza 83', cardTitle: 'BALIZA 83', qrHash: '60125856333f9435e94e38e861241013aeb31369d85bfb26993d1a8d458ad16c', backupHash: '918f8c3d34cc0ed438b7620bbef122746e8bb2e78a7f3ba5dd5de4a938b6d5d1' },
  { id: '84', type: 'CONTROL', label: 'Baliza 84', cardTitle: 'BALIZA 84', qrHash: '18284fe806de58bb96b7a85f634af5803294947492a334e776f3f8edf015da76', backupHash: 'b023b629afec23140b5ce39d8d8e528ea32184cedd730128b53f924f2a02e1dc' },
  { id: '85', type: 'CONTROL', label: 'Baliza 85', cardTitle: 'BALIZA 85', qrHash: 'cbae2d0038103d8600ae16761267d36e51dfa599fe245d430f0833508750a64f', backupHash: '582a6f847fc45bf2a847c387981e2b2e0c93f3ef112c839a938221d4ecf47143' },
  { id: '86', type: 'CONTROL', label: 'Baliza 86', cardTitle: 'BALIZA 86', qrHash: '22bdbcd0fe814de65d5f7692ce48291ac3e51c69e6d7fb110fccb6da154a8a28', backupHash: '499906116e6409238153eba6686c6b5024e4b877476d6c00980f202974d66422' },
  { id: '87', type: 'CONTROL', label: 'Baliza 87', cardTitle: 'BALIZA 87', qrHash: '5c0ec4a68fc0dd436a5318e18706f510fb73751513ca08c5d794d6f31a0863ae', backupHash: '5e073f49018a7b33a2f028f3a51e0482b69d16c8cbdf30bf13fb8a11f6cb12b5' },
  { id: '88', type: 'CONTROL', label: 'Baliza 88', cardTitle: 'BALIZA 88', qrHash: 'd3473b1510e17ead6e3ac30fcbd320adffe6d14b64df79f67f7e75122df0ed82', backupHash: '0548d53cae847f583f6c44a393fd7af9427c6766a136bc8b802b6f55612d4c26' },
  { id: '89', type: 'CONTROL', label: 'Baliza 89', cardTitle: 'BALIZA 89', qrHash: '387fd47bfdc73f4a9099d29e116ed9ad423e2317d04640ef57d0df16a54bad54', backupHash: '712faf1f94c64ad3e181ee32d191b8dd56b95dbec6566e351f6f7a50b8a36ba1' },
  { id: '90', type: 'CONTROL', label: 'Baliza 90', cardTitle: 'BALIZA 90', qrHash: 'd6507cf1ecac74fbdb4f0c2a479456795834bae6c1af8b9115d52fd20543e5e9', backupHash: '163bd9995fa6fad231d578cd2e7e849e46525341364aa69eccb38935bb3dba1e' },
  { id: '91', type: 'CONTROL', label: 'Baliza 91', cardTitle: 'BALIZA 91', qrHash: 'ee7028ee9d0b919268e87ff9d865357f9447ed97f652efb373df3435987f7610', backupHash: '9987f9daa9d2cf1f7cc0494b975a1b69ef3316542ea4a1d11996293bdabd5288' },
  { id: '92', type: 'CONTROL', label: 'Baliza 92', cardTitle: 'BALIZA 92', qrHash: '0bad6e2b513d5c220c45511a0783608d27e7e3fc2eecb514445e68a814b6f593', backupHash: '5a449cbab37cd2f8359790a268fede05dec99ca7ff9f27fb3e0150f4357a525b' },
  { id: '93', type: 'CONTROL', label: 'Baliza 93', cardTitle: 'BALIZA 93', qrHash: 'ffb8b8a3dfe178182d96da55bdcddbdf23ae6eda91fb5005d607faee18dd628a', backupHash: '5b7192433ea63cb958a85c39246e0dd931ce46366edfeea39591d158e6c23e50' },
  { id: '94', type: 'CONTROL', label: 'Baliza 94', cardTitle: 'BALIZA 94', qrHash: '2e18b83e293b2b2ceff676b39baf0cfdc0191adc942f797f1d3e46d2e080c3bd', backupHash: '4e11f5c284621264f5436a5bb42965193739f641441d5694e1cb5785a590957f' },
  { id: '95', type: 'CONTROL', label: 'Baliza 95', cardTitle: 'BALIZA 95', qrHash: '255051fa12295d546a9ad47593c39018bd877d29d9eb9eada371c6791be35ad0', backupHash: '8c480c3a5da46657faeb204aceb4877db19d9eb9b20224d786395b25be67fc38' },
  { id: '96', type: 'CONTROL', label: 'Baliza 96', cardTitle: 'BALIZA 96', qrHash: '58510e752b5b8015d0b24dd87ea9c2346e97ce3c420d72de5e088d8ae899b218', backupHash: '1a0b022ecb2dd2d1c41cc8c814485db683f251400a2f602f2fc0cc6ce587ea7f' },
  { id: '97', type: 'CONTROL', label: 'Baliza 97', cardTitle: 'BALIZA 97', qrHash: '32cbb6282d7e6fd0f1e9c5f13e368512fd56d5e7a507438fcb2bba848e33030c', backupHash: '41a3bc29a4e3f9a1b9dbe670f128d9209c527d1ef9405d961c77cdf5ab02287e' },
  { id: '98', type: 'CONTROL', label: 'Baliza 98', cardTitle: 'BALIZA 98', qrHash: 'fb571cbeda722e058a16fd5576e5444e7186782cdb5c71b10e069b3e3bed0187', backupHash: '36628aae0ff9424e06487776a4abbd42fc2b5fe8f603649e5a685d7aef0073f1' },
  { id: '99', type: 'CONTROL', label: 'Baliza 99', cardTitle: 'BALIZA 99', qrHash: '84de151635e6a440eeff1dd548aec1af913e2d521eb35a07256f4f6499410ef6', backupHash: 'ac838ed10334715fca3bc78e248a030bddcf64398c1b6ee40d3dcd99cc762283' },
  { id: '100', type: 'FINISH', label: 'META (100)', cardTitle: 'META', qrHash: 'f0d879c8b8d4e892e18ff26c90ebbdfa7598c130b61738a5b65520036c833547', backupHash: '2a6c5d223c809c361bcd4ffba6838bfcf66affa4d79197cbd20f29760e14a329' },
];

const BY_QR_HASH = new Map<string, HashedControlDefinition>(
  OFFICIAL_CONTROLS.map((ctrl) => [ctrl.qrHash, ctrl])
);

const BY_BACKUP_HASH = new Map<string, HashedControlDefinition>(
  OFFICIAL_CONTROLS.map((ctrl) => [ctrl.backupHash, ctrl])
);

/**
 * Resolves either a full QR payload (e.g. "ORI:1:XXX") or a 3-character manual backup code
 * into its official HashedControlDefinition by comparing salted SHA-256 hashes.
 */
export function resolveControlInput(rawInput: string, mode: 'QR' | 'MANUAL'): HashedControlDefinition | null {
  const cleaned = rawInput.trim().toUpperCase();
  if (!cleaned) return null;

  const inputHash = hashControlSecret(cleaned);

  if (mode === 'QR') {
    return BY_QR_HASH.get(inputHash) ?? BY_BACKUP_HASH.get(inputHash) ?? null;
  }

  return BY_BACKUP_HASH.get(inputHash) ?? BY_QR_HASH.get(inputHash) ?? null;
}
