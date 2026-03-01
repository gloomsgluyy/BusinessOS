const { jsPDF } = require("jspdf");
const fs = require('fs');
const path = require('path');

async function testPdf() {
    try {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("MINUTES OF MEETING", 105, 20, { align: "center" });

        const title = "Weekly Sync #42";
        const date = "2024-03-01";
        const time = "10:00";
        const location = "Zoom / Room 4A";
        // Long string test
        const attendees = ["John Doe", "Jane Doe", "Jim Smith", "Someone Else", "Another Person", "Yet Another Person", "Bob", "Alice"];

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Title: ${title}`, 20, 40);
        doc.text(`Date & Time: ${date} ${time}`, 20, 50);
        doc.text(`Location: ${location}`, 20, 60);

        const attendeesText = `Attendees: ${attendees.join(", ")}`;
        const splitAttendees = doc.splitTextToSize(attendeesText, 170);
        doc.text(splitAttendees, 20, 70);

        let yOffset = 70 + (splitAttendees.length * 7);
        doc.line(20, yOffset, 190, yOffset);
        yOffset += 10;

        doc.setFont("helvetica", "bold");
        doc.text("Meeting Notes / Transcript:", 20, yOffset);
        yOffset += 10;

        doc.setFont("helvetica", "normal");
        const mainContent = "1. Discussed Q3 roadmap\n2. AI integration updates were greenlit\n3. Budget review for next month - APPROVED.\n\n[Action Items]\n- John to prepare slides for Friday.\n- Jane to finalize the prototype.\n\nThis is a long line test to see how the jsPDF library handles splitting text into multiple lines when the content reaches the end of the page border. It should wrap properly without overlapping side borders or disappearing off the page.\n\nThanks everyone for joining.";

        const splitContent = doc.splitTextToSize(mainContent, 170);

        for (let i = 0; i < splitContent.length; i++) {
            if (yOffset > 280) {
                doc.addPage();
                yOffset = 20;
            }
            doc.text(splitContent[i], 20, yOffset);
            yOffset += 7;
        }

        const outputPath = path.join(__dirname, 'test_mom_export.pdf');
        fs.writeFileSync(outputPath, doc.output());
        console.log("PDF export succeeded. Saved to: " + outputPath);
    } catch (err) {
        console.error("PDF export failed:", err);
    }
}

testPdf();
