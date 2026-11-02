// Extract original embedded JPEG scans for reading; no image transformation.
const fs = require('node:fs'), path = require('node:path');
const { PDFDocument, PDFName, PDFRawStream } = require('pdf-lib');
(async () => {
  for (const file of ['sss-circular.pdf', 'pagibig-460.pdf', 'bir-29-2025.pdf']) {
    const pdf = await PDFDocument.load(fs.readFileSync(path.join(__dirname, 'sources', file)));
    for (const [ref, object] of pdf.context.enumerateIndirectObjects()) {
      if (object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image' && object.dict.get(PDFName.of('Filter'))?.toString() === '/DCTDecode') {
        const name = file + '-' + ref.objectNumber + '.jpg';
        fs.writeFileSync(path.join(__dirname, 'sources', name), object.getContents());
        console.log(name, object.dict.get(PDFName.of('Width'))?.toString(), object.dict.get(PDFName.of('Height'))?.toString());
      }
    }
  }
})();
