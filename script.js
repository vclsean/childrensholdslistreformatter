document.getElementById('processButton').addEventListener('click', function() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let processedData = processSpreadsheet(jsonData);
        displayTable(processedData);
        document.getElementById('printButton').style.display = 'block';
    };

    reader.readAsArrayBuffer(file);
});

function processSpreadsheet(data) {
    if (data.length < 3) return [];

    data.splice(0, 1);
    data.splice(1, 1);

    for (let row of data) {
        if (row[1] === undefined || row[1] === null || row[1] === '') {
            row[1] = '---';
        }
    }

    const headers = data[0];
    const collectionIndex = headers.indexOf("Collection");
    const shelvingLocationIndex = headers.indexOf("Shelving location");

    if (collectionIndex !== -1 && shelvingLocationIndex !== -1) {
        data = data.filter((row, index) => {
            if (index === 0) return true;
            const isAdultOrYoungAdult = row[collectionIndex] === "Adult Collection" || row[collectionIndex] === "Young Adult Collection";
            const isParentingMaterials = row[shelvingLocationIndex] && row[shelvingLocationIndex].includes("Parenting materials");
            return !(isAdultOrYoungAdult && !isParentingMaterials);
        });
    }

    const columnsToDelete = ["Publication details", "Send to", "Notes", "Date", "Collection"];
    const indicesToDelete = [];

    for (let i = 0; i < headers.length; i++) {
        if (columnsToDelete.includes(headers[i])) {
            indicesToDelete.push(i);
        }
    }
    indicesToDelete.sort((a, b) => b - a);

    for (const index of indicesToDelete) {
        for (const row of data) {
            row.splice(index, 1);
        }
    }

    const titleIndex = headers.indexOf("Title");
    if (titleIndex !== -1) {
        for (let i = 1; i < data.length; i++) {
            if (data[i][titleIndex]) {
                data[i][titleIndex] = data[i][titleIndex].replace(/\d{5,}/g, '');
            }
        }
    }

    const barcodeIndex = headers.indexOf("Barcode");
    if (barcodeIndex !== -1) {
        for (let i = 1; i < data.length; i++) {
            if (data[i][barcodeIndex]) {
                data[i][barcodeIndex] = data[i][barcodeIndex].replace(" or any available", "");
            }
        }
    }

    const callNumberIndex = headers.indexOf("Call number");
    if (callNumberIndex !== -1) {
        const rowsToDelete = [];
        for (let i = 1; i < data.length; i++) {
            if (data[i][callNumberIndex]) {
                const callNumber = data[i][callNumberIndex];
                if (callNumber.startsWith("YA ")) {
                    rowsToDelete.push(i);
                }
            }
        }
        rowsToDelete.sort((a, b) => b - a);
        for (const rowIndex of rowsToDelete) {
            data.splice(rowIndex, 1);
        }
    }

    if (data.length > 2) {
        const headerRow = data.shift();
        const shelvingIndex = headers.indexOf("Shelving location");
        const authorIndex = headers.indexOf("Author");
        const titleIndexSort = headers.indexOf("Title");

        if (shelvingIndex !== -1 && callNumberIndex !== -1 && authorIndex !== -1 && titleIndexSort !== -1) {
            data.sort((a, b) => {
                if (a[shelvingIndex] > b[shelvingIndex]) return 1;
                if (a[shelvingIndex] < b[shelvingIndex]) return -1;
                if (a[callNumberIndex] > b[callNumberIndex]) return 1;
                if (a[callNumberIndex] < b[callNumberIndex]) return -1;
                if (a[authorIndex] > b[authorIndex]) return 1;
                if (a[authorIndex] < b[authorIndex]) return -1;
                if (a[titleIndexSort] > b[titleIndexSort]) return 1;
                if (a[titleIndexSort] < b[titleIndexSort]) return -1;
                return 0;
            });
        }
        data.unshift(headerRow);

        if (shelvingIndex !== -1) {
            for (let i = 1; i < data.length; i++) {
                if (data[i][shelvingIndex] === "General Fiction") data[i][shelvingIndex] = "Fiction";
                if (data[i][shelvingIndex] === "Non-Entertainment DVD") data[i][shelvingIndex] = "DOC DVD";
                if (data[i][shelvingIndex] === "New Non-Entertainment DVD") data[i][shelvingIndex] = "New DOC DVD";
                if (data[i][shelvingIndex] === "Television Series DVD") data[i][shelvingIndex] = "TV DVD";
                if (data[i][shelvingIndex] === "Biography & Autobiography") data[i][shelvingIndex] = "Biography";
                if (data[i][shelvingIndex] === "New Biography & Autobiography") data[i][shelvingIndex] = "New Biography";
                if (data[i][shelvingIndex] === "Book on CD") data[i][shelvingIndex] = "Audiobook";
            }
        }
    }
    const itemTypeIndex = headers.indexOf("Item type");
    if (itemTypeIndex !== -1) {
        for (let i = 1; i < data.length; i++) {
            if (data[i][itemTypeIndex] === "Juvenile Book") {
                data[i][itemTypeIndex] = "Juv Book";
            }
        }
    }

    // Reorder columns
    const desiredOrder = ["Shelving location", "Call number", "Title", "Author", "Item type", "Barcode"];
    const newIndices = desiredOrder.map(header => headers.indexOf(header));

    if (newIndices.every(index => index !== -1)) {
        const newData = data.map(row => newIndices.map(index => row[index]));
        data = newData;
        headers.splice(0, headers.length, ...desiredOrder);
    }

    return data;
}


function displayTable(data) {
    let tableHtml = '<table id="outputTable">';
    if (data.length > 0) {
        tableHtml += '<tr>';
        for (let header of data[0]) {
            tableHtml += '<th>' + (header === undefined ? "" : header) + '</th>';
        }
        tableHtml += '</tr>';

        // Calculate max width for "Call number" column
        const callNumberIndex = data[0].indexOf("Call number");
        let maxCallNumberWidth = 0;
        if (callNumberIndex !== -1) {
            for (let i = 1; i < data.length; i++) {
                const callNumber = data[i][callNumberIndex];
                if (callNumber) {
                    maxCallNumberWidth = Math.max(maxCallNumberWidth, callNumber.length);
                }
            }
        }

        for (let i = 0; i < data.length; i++) {
            if (i === 0) continue;
            tableHtml += '<tr>';
            for (let j = 0; j < data[i].length; j++) {
                let cell = data[i][j];
                if (j === callNumberIndex && callNumberIndex !== -1) {
                    tableHtml += `<td style="width: ${maxCallNumberWidth * 8}px; white-space: nowrap; font-weight: bold;">${cell === undefined ? "" : cell}</td>`;
                } else {
                    tableHtml += '<td>' + (cell === undefined ? "" : cell) + '</td>';
                }
            }
            tableHtml += '</tr>';
        }
    }
    tableHtml += '</table>';
    document.getElementById('output').innerHTML = tableHtml;
}

document.getElementById('printButton').addEventListener('click', function() {
    const printContents = document.getElementById('outputTable').outerHTML;
    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
});
