/** Serve the installed worker locally, keeping resume viewing independent of a CDN. */
export async function getPdfJs() {
  const library = await import('pdfjs-dist')
  library.GlobalWorkerOptions.workerSrc = '/generated/pdf.worker.min.mjs'
  return library
}
