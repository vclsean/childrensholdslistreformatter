document.getElementById('process-btn').addEventListener('click', function() {
    const fileInput = document.getElementById('file-input');
    if (fileInput.files.length === 0) {
        alert('Please upload a spreadsheet first.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON
        let rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Delete the first row and shift all cells up
        rows.shift();

	const headerRow = rows.shift();

        // Search for and delete strings 
        rows = rows.map(row => row.map(cell => (typeof cell === 'string') ? cell.replace(/or any available/g, '') : cell));
        rows = rows.map(row => row.map(cell => (typeof cell === 'string') ? cell.replace(/& Autobiography/g, '') : cell));
        rows = rows.map(row => row.map(cell => (typeof cell === 'string') ? cell.replace(/General Fiction/g, 'Fiction') : cell));
        rows = rows.map(row => row.map(cell => (typeof cell === 'string') ? cell.replace(/DVD DVD /g, 'DVD ') : cell));
        rows = rows.map(row => row.map(cell => (typeof cell === 'string') ? cell.replace(/Blu-Ray /g, '') : cell));
	rows = rows.filter(row => (row[2] || '').toString().includes('Juvenile'));
	rows = rows.filter(row => !((row[3] || '').toString().includes(' YA ')));
 
        // Sort rows by the fourth column (index 3) in alphabetical order
        rows.sort((a, b) => {
            const valueA = (a[3] || '').toString().toLowerCase();
            const valueB = (b[3] || '').toString().toLowerCase();
            return valueA.localeCompare(valueB);
        });

	rows.unshift(headerRow);


        // Process the first column
        rows = rows.map(row => {
            if (row.length > 0) {
                let cell = row[0].toString();
                // Remove numbers with more than three digits
                cell = cell.replace(/\d{4,}/g, '');
                // Remove spaces more than two in a row
                cell = cell.replace(/\s{3,}/g, ' ');
                // Format text before '/' as bold
                const parts = cell.split('/');
                if (parts.length > 1) {
                    row[0] = `<span class="bold">${parts[0]}</span>/${parts.slice(1).join('/')}`;
                } else {
                    row[0] = cell;
                }
                // Delete all text after ", : "
                const index = row[0].indexOf(", : ");
                if (index !== -1) {
                    row[0] = row[0].substring(0, index);
                }
            }
            return row;
        });

        // Delete columns two, six, seven, and eight
        rows = rows.map(row => {
            return row.filter((_, index) => ![1, 5, 6, 7].includes(index));
        });
	    
        // Move the third column to the first column position
        rows = rows.map(row => {
            if (row.length >= 3) {
                const thirdColumn = row[2]; // Extract the third column
                row.splice(2, 1); // Remove the third column
                row.unshift(thirdColumn); // Insert it at the beginning
            }
            return row;
        });

       // Create table and apply formatting
        let html = '<table>';
        rows.forEach((row, rowIndex) => {
            html += '<tr>';
            row.forEach((cell, cellIndex) => {
                const bgColor = (rowIndex === 0) ? '#d3d3d3' : (rowIndex % 2 === 0) ? 'white' : '#ededed'; // Header row color and alternating row colors
                const fontWeight = (rowIndex === 0) ? 'bold' : 'normal'; // Bold for the header row
                html += `<td style="background-color: ${bgColor}; font-weight: ${fontWeight};">${cell}</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';

        document.getElementById('output').innerHTML = html;
        document.getElementById('print-btn').style.display = 'block'; // Show print button
    };

    reader.readAsArrayBuffer(file);
});

document.getElementById('print-btn').addEventListener('click', function() {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Print Table</title>');
    printWindow.document.write('<link rel="stylesheet" href="style.css">'); // Ensure styles are applied
    printWindow.document.write('</head><body >');
    printWindow.document.write(document.getElementById('output').innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function() {
        printWindow.print();
    }, 250);
});

