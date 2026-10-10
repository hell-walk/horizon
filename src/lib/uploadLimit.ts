// How big a statement file can be. It travels to the server in one request,
// and Vercel accepts at most 4.5 MB per request, so files are capped at 4 MB
// (room for the rest of the form). The browser checks first, so nobody waits
// for an upload that would be refused. Most banks let people download a
// shorter period when a statement is bigger than this.
export const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
