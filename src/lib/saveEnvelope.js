const FORMAT = 'gzip-base64-v1';

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary);
}

export async function encodeCloudSave(save) {
  const json = JSON.stringify(save);
  if (typeof CompressionStream === 'undefined') return save;
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return { id: save.id, format: FORMAT, payload: bytesToBase64(bytes) };
}

export async function decodeCloudSave(envelope) {
  if (envelope?.format !== FORMAT) return envelope;
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed cloud saves.');
  const binary = atob(envelope.payload);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const json = await new Response(stream).text();
  const save = JSON.parse(json);
  if (save?.id !== envelope.id) throw new Error('Cloud save identity does not match its envelope.');
  return save;
}
