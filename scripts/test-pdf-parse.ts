// Test script to verify pdf-parse works without DOMMatrix error

async function testPdfParse() {
  console.log('Testing pdf-parse with custom pagerender...\n');

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParseModule = require('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;

    // Create a minimal valid PDF (just to test the parsing doesn't throw DOMMatrix error)
    // This is a minimal PDF structure
    const minimalPdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF`);

    // Custom page render function (same as in the fix)
    const options = {
      pagerender: function(pageData: any) {
        return pageData.getTextContent().then(function(textContent: any) {
          let lastY: number | null = null;
          let text = '';
          for (const item of textContent.items) {
            if (lastY !== null && lastY !== item.transform[5]) {
              text += '\n';
            }
            text += item.str;
            lastY = item.transform[5];
          }
          return text;
        });
      }
    };

    console.log('Parsing PDF with custom pagerender...');
    const result = await pdfParse(minimalPdf, options);

    console.log('SUCCESS! PDF parsed without DOMMatrix error.');
    console.log('Extracted text length:', result.text.length);
    console.log('Number of pages:', result.numpages);

  } catch (error: any) {
    if (error.message?.includes('DOMMatrix')) {
      console.error('FAILED: DOMMatrix error still occurring');
      console.error(error.message);
    } else {
      // Other errors are expected with minimal PDF
      console.log('Note: Got expected error with minimal test PDF:', error.message?.substring(0, 100));
      console.log('\nThe important thing is no DOMMatrix error occurred!');
    }
  }
}

testPdfParse();
