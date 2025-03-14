  /*************** Global Variables & Setup ***************/
  let jsonData = [];
  let dataFormat = ''; // 'csv' or 'excel'
  let globalHeaders = [];
  let currentColumns = [];
  let currentPage = 1;
  const itemsPerPage = 20;
  let chartInstance = null;
  let filteredData = [];  // holds filtered rows (for CSV: full rows, for Excel: rows excluding header)
  let currentSort = { column: null, ascending: true };

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const spinnerBackdrop = document.getElementById('spinnerBackdrop');

  // Dark Mode Toggle already set in the sidebar
  document.getElementById('darkModeToggleTop').addEventListener('change', (e) => {
    document.body.classList.toggle('dark-mode', e.target.checked);
  });

  // Drag-and-drop events
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  /*************** File Handling ***************/
  function handleFile(file) {
    console.log("File selected:", file.name);
    const reader = new FileReader();
    currentPage = 1;
    spinnerBackdrop.classList.add('show');
    if (file.name.toLowerCase().endsWith('.csv')) {
      dataFormat = 'csv';
      reader.onload = function(e) {
        console.log("CSV file read successfully.");
        jsonData = Papa.parse(e.target.result, { header: true, skipEmptyLines: true }).data;
        spinnerBackdrop.classList.remove('show');
        if (jsonData.length > 0) {
          currentColumns = Object.keys(jsonData[0]);
          displayTable(jsonData, currentPage);
          populateDropdowns(currentColumns);
          populateFilterColumnOptions();
          populatePivotOptions(); 
          updateDataSummary();
        } else {
          console.error("No data found in CSV file.");
        }
      };
      reader.onerror = function(e) {
        console.error("Error reading CSV file:", e);
        spinnerBackdrop.classList.remove('show');
      };
      reader.readAsText(file);
    } else {
      dataFormat = 'excel';
      reader.onload = function(e) {
        console.log("Excel file read successfully.");
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        spinnerBackdrop.classList.remove('show');
        if (jsonData.length > 0) {
          globalHeaders = jsonData[0];
          currentColumns = [...globalHeaders];
          displayTable(jsonData, currentPage);
          populateDropdowns(currentColumns);
          populateFilterColumnOptions();
          populatePivotOptions(); 
          updateDataSummary();
        } else {
          console.error("No data found in Excel file.");
        }
      };
      reader.onerror = function(e) {
        console.error("Error reading Excel file:", e);
        spinnerBackdrop.classList.remove('show');
      };
      reader.readAsArrayBuffer(file);
    }
  }

  /*************** Table Display & Pagination ***************/
  function displayTable(data, page = 1) {
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');
  tableHead.innerHTML = '';
  tableBody.innerHTML = '';

  if (dataFormat === 'excel') {
    // If it's Excel data (first row is headers)
    if (data.length === 0) return;

    // Create header row with checkboxes
    const headerRow = document.createElement('tr');
    globalHeaders.forEach((colName, colIndex) => {
      const th = document.createElement('th');
      
      // Build a label containing a checkbox + the column name
      const label = document.createElement('label');
      label.style.whiteSpace = 'nowrap'; // keep text & checkbox together

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true; // default visible
      checkbox.addEventListener('change', () => {
        toggleColumnVisibility(colIndex, checkbox.checked);
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + colName));

      th.appendChild(label);
      th.setAttribute('data-colindex', colIndex);
      headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Data rows (skip first row of Excel data)
    const dataRows = data.slice(1);
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    dataRows.slice(start, end).forEach(row => {
      const tr = document.createElement('tr');
      row.forEach((cell, colIndex) => {
        const td = document.createElement('td');
        td.textContent = cell;
        td.setAttribute('data-colindex', colIndex);
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });

    updatePagination(dataRows.length, page);

  } else {
    // If it's CSV data (array of objects)
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);

    // Create header row with checkboxes
    const headerRow = document.createElement('tr');
    keys.forEach((colName, colIndex) => {
      const th = document.createElement('th');
      
      const label = document.createElement('label');
      label.style.whiteSpace = 'nowrap';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.addEventListener('change', () => {
        toggleColumnVisibility(colIndex, checkbox.checked);
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + colName));

      th.appendChild(label);
      th.setAttribute('data-colindex', colIndex);
      headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    data.slice(start, end).forEach(row => {
      const tr = document.createElement('tr');
      keys.forEach((colName, colIndex) => {
        const td = document.createElement('td');
        td.textContent = row[colName];
        td.setAttribute('data-colindex', colIndex);
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });

    updatePagination(data.length, page);
  }
}


  function updatePagination(totalItems, page) {
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const prevButton = document.createElement('button');
    prevButton.className = 'btn btn-secondary btn-sm';
    prevButton.textContent = 'Previous';
    prevButton.disabled = (page <= 1);
    prevButton.onclick = () => {
      currentPage = page - 1;
      // Always display the FILTERED data, not the original data
      if (dataFormat === 'excel') {
        displayTable([globalHeaders].concat(filteredData), currentPage);
      } else {
        displayTable(filteredData, currentPage);
      }
    };

    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` Page ${page} of ${totalPages} `;

    const nextButton = document.createElement('button');
    nextButton.className = 'btn btn-secondary btn-sm';
    nextButton.textContent = 'Next';
    nextButton.disabled = (page >= totalPages);
    nextButton.onclick = () => {
      currentPage = page + 1;
      // Same here: use filteredData
      if (dataFormat === 'excel') {
        displayTable([globalHeaders].concat(filteredData), currentPage);
      } else {
        displayTable(filteredData, currentPage);
      }
    };

    paginationDiv.appendChild(prevButton);
    paginationDiv.appendChild(pageInfo);
    paginationDiv.appendChild(nextButton);
}

  function toggleColumnVisibility(colIndex, isVisible) {
  // For the given column index, find all <th> and <td> with data-colindex
  const headerCells = document.querySelectorAll(`#dataTable thead th[data-colindex='${colIndex}']`);
  const bodyCells = document.querySelectorAll(`#dataTable tbody td[data-colindex='${colIndex}']`);

  if (isVisible) {
    headerCells.forEach(cell => cell.classList.remove('hide-col'));
    bodyCells.forEach(cell => cell.classList.remove('hide-col'));
  } else {
    headerCells.forEach(cell => cell.classList.add('hide-col'));
    bodyCells.forEach(cell => cell.classList.add('hide-col'));
  }
}
  function resetColumnVisibility() {
  // Get all header checkboxes (they are inside the table header <th>)
  const headerCheckboxes = document.querySelectorAll("#tableHead th input[type='checkbox']");
  headerCheckboxes.forEach((checkbox) => {
    checkbox.checked = true; // check each box
    // Get the column index from the parent th's data attribute
    const colIndex = checkbox.parentElement.parentElement.getAttribute("data-colindex");
    // Make sure the column is visible by removing the hide class
    toggleColumnVisibility(colIndex, true);
  });
}


  function reapplyHiddenColumns() {
    const columnManager = document.getElementById('columnManager');
    const checkboxes = columnManager.querySelectorAll('input[type=checkbox]');
    checkboxes.forEach(cb => {
      if (!cb.checked) {
        const colName = cb.value;
        const allCells = document.querySelectorAll(`[data-colname='${colName}']`);
        allCells.forEach(cell => cell.classList.add('hide-col'));
      }
    });
  }
      /*************** Sorting ***************/
      function sortTableByColumn(colIndex) {
    // Toggle sort if same column; otherwise, sort ascending
    if (currentSort.column === colIndex) {
      currentSort.ascending = !currentSort.ascending;
    } else {
      currentSort.column = colIndex;
      currentSort.ascending = true;
    }
    // For Excel: sort filteredData array (which does NOT include header)
    if (dataFormat === 'excel') {
      filteredData.sort((a, b) => {
        const valA = a[colIndex];
        const valB = b[colIndex];
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return currentSort.ascending ? numA - numB : numB - numA;
        } else {
          return currentSort.ascending ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        }
      });
      displayTable([globalHeaders].concat(filteredData), 1);
    } else {
      filteredData.sort((a, b) => {
        const key = currentColumns[colIndex];
        const valA = a[key];
        const valB = b[key];
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return currentSort.ascending ? numA - numB : numB - numA;
        } else {
          return currentSort.ascending ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        }
      });
      displayTable(filteredData, 1);
    }
  }

  /*************** Advanced Filtering: Live Search & Filter Panel ***************/
  // Live Search: filter rows that contain the query in any cell
  function applyLiveSearch() {
    const query = document.getElementById('tableSearch').value.toLowerCase();
    if (dataFormat === 'excel') {
      filteredData = jsonData.slice(1).filter(row => row.some(cell => String(cell).toLowerCase().includes(query)));
      displayTable([globalHeaders].concat(filteredData), 1);
    } else {
      filteredData = jsonData.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(query)));
      displayTable(filteredData, 1);
    }
  }

  function populateFilterColumnOptions() {
    const filterColumn = document.getElementById('filterColumn');
    if (!filterColumn) {
      console.error("No element with id 'filterColumn' found.");
      return;
    }
    filterColumn.innerHTML = ''; // Clear any existing options
    
    // Log the current columns for debugging
    console.log("Populating filterColumn with:", currentColumns);
    
    if (currentColumns.length === 0) {
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "No Columns Available";
      filterColumn.appendChild(option);
    } else {
      currentColumns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        filterColumn.appendChild(option);
      });
    }
  }


  // Apply filter based on selected column, operator, and filter value
  function applyFilter() {
    const col = document.getElementById('filterColumn').value;
    const operator = document.getElementById('filterOperator').value;
    const value = document.getElementById('filterValue').value.toLowerCase();
    if (!col || !operator) return;
    if (dataFormat === 'excel') {
      filteredData = jsonData.slice(1).filter(row => {
        const cellVal = String(row[globalHeaders.indexOf(col)]).toLowerCase();
        if (operator === 'contains') return cellVal.includes(value);
        if (operator === 'equals') return cellVal === value;
        if (operator === 'lt') return parseFloat(cellVal) < parseFloat(value);
        if (operator === 'gt') return parseFloat(cellVal) > parseFloat(value);
        return true;
      });
      displayTable([globalHeaders].concat(filteredData), 1);
    } else {
      filteredData = jsonData.filter(row => {
        const cellVal = String(row[col]).toLowerCase();
        if (operator === 'contains') return cellVal.includes(value);
        if (operator === 'equals') return cellVal === value;
        if (operator === 'lt') return parseFloat(cellVal) < parseFloat(value);
        if (operator === 'gt') return parseFloat(cellVal) > parseFloat(value);
        return true;
      });
      displayTable(filteredData, 1);
    }
  }

  // Clear filter and reset filteredData
  function clearFilter() {
    document.getElementById('tableSearch').value = '';
    document.getElementById('filterValue').value = '';
    if (dataFormat === 'excel') {
      filteredData = jsonData.slice(1);
      displayTable([globalHeaders].concat(filteredData), 1);
    } else {
      filteredData = jsonData.slice();
      displayTable(filteredData, 1);
    }
  }
  /*************** Data Summary & Cleaning ***************/
  function updateDataSummary() {
    const summaryDiv = document.getElementById('dataSummary');
    let totalRows = dataFormat === 'excel' ? jsonData.length - 1 : jsonData.length;
    let missingCount = 0;
    if (dataFormat === 'excel') {
      jsonData.slice(1).forEach(row => {
        row.forEach(cell => { if (cell === '' || cell === null || cell === undefined) missingCount++; });
      });
    } else {
      jsonData.forEach(row => {
        Object.values(row).forEach(val => { if (val === '' || val === null || val === undefined) missingCount++; });
      });
    }
    summaryDiv.innerHTML = `<p>Total Rows: ${totalRows}</p><p>Total Missing Values: ${missingCount}</p>`;
  }

  function removeMissing() {
    if (dataFormat === 'excel') {
      const header = jsonData[0];
      const filtered = jsonData.slice(1).filter(row =>
        row.every(cell => cell !== '' && cell !== null && cell !== undefined)
      );
      jsonData = [header].concat(filtered);
    } else {
      jsonData = jsonData.filter(row =>
        Object.values(row).every(val => val !== '' && val !== null && val !== undefined)
      );
    }
    displayTable(jsonData, currentPage);
    updateDataSummary();
  }

  function fillMissing() {
    const fillValue = document.getElementById('fillValue').value;
    if (dataFormat === 'excel') {
      for (let i = 1; i < jsonData.length; i++) {
        for (let j = 0; j < jsonData[i].length; j++) {
          if (jsonData[i][j] === '' || jsonData[i][j] === null || jsonData[i][j] === undefined) {
            jsonData[i][j] = fillValue;
          }
        }
      }
    } else {
      jsonData.forEach(row => {
        for (const key in row) {
          if (row[key] === '' || row[key] === null || row[key] === undefined) {
            row[key] = fillValue;
          }
        }
      });
    }
    displayTable(jsonData, currentPage);
    updateDataSummary();
  }

  function removeDuplicates() {
    if (dataFormat === 'excel') {
      const header = jsonData[0];
      const seen = new Set();
      const filtered = jsonData.slice(1).filter(row => {
        const key = row.join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      jsonData = [header].concat(filtered);
    } else {
      const seen = new Set();
      jsonData = jsonData.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    displayTable(jsonData, currentPage);
    updateDataSummary();
  }

  function flagDuplicates() {
    let duplicateCount = 0;
    const seen = new Set();
    if (dataFormat === 'excel') {
      jsonData.slice(1).forEach(row => {
        const key = row.join('|');
        if (seen.has(key)) duplicateCount++;
        else seen.add(key);
      });
    } else {
      jsonData.forEach(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) duplicateCount++;
        else seen.add(key);
      });
    }
    alert("Found " + duplicateCount + " duplicate rows.");
  }

  /*************** Dropdowns & Column Type ***************/
  function populateDropdowns(headers) {
    const xSelect = document.getElementById('x-axis');
    const ySelect = document.getElementById('y-axis');
    xSelect.innerHTML = '';
    ySelect.innerHTML = '';
    headers.forEach(h => {
      const optX = document.createElement('option');
      optX.value = h;
      optX.textContent = h;
      xSelect.appendChild(optX);
      const optY = document.createElement('option');
      optY.value = h;
      optY.textContent = h;
      ySelect.appendChild(optY);
    });
    updateGraphOptions();
  }

  function populatePivotOptions() {
    const pivotGroupBy = document.getElementById('pivotGroupBy');
    const pivotValue = document.getElementById('pivotValue');
    if (!pivotGroupBy || !pivotValue) return;
    pivotGroupBy.innerHTML = '';
    pivotValue.innerHTML = '';
    currentColumns.forEach(col => {
      const opt1 = document.createElement('option');
      opt1.value = col;
      opt1.textContent = col;
      pivotGroupBy.appendChild(opt1);
      const opt2 = document.createElement('option');
      opt2.value = col;
      opt2.textContent = col;
      pivotValue.appendChild(opt2);
    });
  }

  function determineColType(data, colKey) {
    let numericCount = 0, totalCount = 0;
    for (let i = 0; i < data.length && i < 100; i++) {
      const val = getCellValue(data[i], colKey);
      if (val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val))) numericCount++;
      totalCount++;
    }
    return totalCount === 0 ? 'categorical' : (numericCount > totalCount / 2 ? 'numeric' : 'categorical');
  }

  function getCellValue(row, colKey) {
    if (dataFormat === 'excel') {
      const colIndex = globalHeaders.indexOf(colKey);
      return row[colIndex];
    } else {
      return row[colKey];
    }
  }

  function updateGraphOptions() {
    const xKey = document.getElementById('x-axis').value;
    const yKey = document.getElementById('y-axis').value;
    if (!xKey || !yKey) return;
    const xType = determineColType(jsonData, xKey);
    const yType = determineColType(jsonData, yKey);
    const chartTypeSelect = document.getElementById('chart-type');
    chartTypeSelect.innerHTML = '';
    let options = [];
    if (xType === 'numeric' && yType === 'numeric') {
      options = ['Scatter Plot', 'Line Chart', 'Histogram', 'Area Chart', 'Bubble Chart'];
    } else if (xType === 'categorical' && yType === 'numeric') {
      options = ['Bar Chart', 'Grouped Bar Chart', 'Pie Chart', 'Stacked Bar Chart'];
    } else if (xType === 'numeric' && yType === 'categorical') {
      options = ['Bar Chart', 'Stacked Bar Chart'];
    } else {
      options = ['Stacked Bar Chart', 'Pie Chart'];
    }
    options.forEach(opt => {
      const optionElem = document.createElement('option');
      optionElem.value = opt;
      optionElem.textContent = opt;
      chartTypeSelect.appendChild(optionElem);
    });
  }
  document.getElementById('x-axis').addEventListener('change', updateGraphOptions);
  document.getElementById('y-axis').addEventListener('change', updateGraphOptions);

  /*************** Chart Generation Logic ***************/
  function generateChart() {
    if (jsonData.length < 1) return;
    const selectedOption = document.getElementById('chart-type').value;
    const xKey = document.getElementById('x-axis').value;
    const yKey = document.getElementById('y-axis').value;
    const xType = determineColType(jsonData, xKey);
    const yType = determineColType(jsonData, yKey);
    if (chartInstance) {
      chartInstance.destroy();
    }
    const ctx = document.getElementById('chart').getContext('2d');
    let chartConfig = null;
    if (xType === 'numeric' && yType === 'numeric') {
      if (selectedOption === 'Scatter Plot') {
        chartConfig = buildScatterConfig(jsonData, xKey, yKey);
      } else if (selectedOption === 'Line Chart') {
        chartConfig = buildLineConfig(jsonData, xKey, yKey);
      } else if (selectedOption === 'Histogram') {
        chartConfig = buildHistogramConfig(jsonData, xKey);
      } else if (selectedOption === 'Area Chart') {
        chartConfig = buildAreaChart(jsonData, xKey, yKey);
      } else if (selectedOption === 'Bubble Chart') {
        chartConfig = buildBubbleChart(jsonData, xKey, yKey);
      }
    } else if (xType === 'categorical' && yType === 'numeric') {
      if (selectedOption === 'Bar Chart') {
        chartConfig = buildBarCatXNumericY(jsonData, xKey, yKey);
      } else if (selectedOption === 'Grouped Bar Chart') {
        chartConfig = buildGroupedBarChart(jsonData, xKey, yKey);
      } else if (selectedOption === 'Pie Chart') {
        chartConfig = buildPieCatXNumericY(jsonData, xKey, yKey);
      } else if (selectedOption === 'Stacked Bar Chart') {
        chartConfig = buildStackedBarCatXNumericY(jsonData, xKey, yKey);
      }
    } else if (xType === 'numeric' && yType === 'categorical') {
      if (selectedOption === 'Bar Chart') {
        chartConfig = buildBarNumericXCatY(jsonData, xKey, yKey);
      } else if (selectedOption === 'Stacked Bar Chart') {
        chartConfig = buildStackedBarNumericXCatY(jsonData, xKey, yKey);
      }
    } else {
      if (selectedOption === 'Stacked Bar Chart') {
        chartConfig = buildStackedBarCatXCatY(jsonData, xKey, yKey);
      } else if (selectedOption === 'Pie Chart') {
        chartConfig = buildPieCatXCatY(jsonData, xKey, yKey);
      }
    }
    chartInstance = new Chart(ctx, chartConfig);
  }

  /*************** Chart Helper Functions ***************/
  function buildGroupedBarChart(data, xKey, yKey) {
    const groups = {};
    data.forEach(row => {
      const group = row[xKey] || 'Undefined';
      const value = parseFloat(row[yKey]);
      if (!isNaN(value)) {
        if (!groups[group]) groups[group] = [];
        groups[group].push(value);
      }
    });
    const labels = Object.keys(groups);
    const dataset1 = [];
    const dataset2 = [];
    labels.forEach(label => {
      const values = groups[label];
      // Split values into two groups: even and odd index positions
      let evenSum = 0, evenCount = 0, oddSum = 0, oddCount = 0;
      values.forEach((val, i) => {
        if (i % 2 === 0) { evenSum += val; evenCount++; }
        else { oddSum += val; oddCount++; }
      });
      dataset1.push(evenCount ? (evenSum / evenCount).toFixed(2) : 0);
      dataset2.push(oddCount ? (oddSum / oddCount).toFixed(2) : 0);
    });
    return {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Group 1',
            data: dataset1,
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            borderRadius: 5
          },
          {
            label: 'Group 2',
            data: dataset2,
            backgroundColor: 'rgba(255, 159, 64, 0.5)',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 1,
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: xKey, font: { size: 16 } }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: yKey, font: { size: 16 } }, grid: { color: '#eee' } }
        },
        plugins: {
          title: { display: true, text: `${xKey} vs ${yKey} (Grouped Bar Chart)`, font: { family: 'Roboto', size: 18 } },
          tooltip: { backgroundColor: '#333', titleFont: { family: 'Roboto', size: 16 }, bodyFont: { family: 'Roboto', size: 14 } }
        }
      }
    };
  }

  function buildBubbleChart(data, xKey, yKey) {
    const bubbles = [];
    data.forEach(row => {
      const xVal = parseFloat(getCellValue(row, xKey));
      const yVal = parseFloat(getCellValue(row, yKey));
      if (!isNaN(xVal) && !isNaN(yVal)) {
        bubbles.push({ x: xVal, y: yVal, r: 10 }); // Using a fixed radius; adjust as needed
      }
    });
    return {
      type: 'bubble',
      data: {
        datasets: [{
          label: `${xKey} vs ${yKey} (Bubble Chart)`,
          data: bubbles,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: 'linear', position: 'bottom', title: { display: true, text: xKey, font: { size: 16 } } },
          y: { beginAtZero: true, title: { display: true, text: yKey, font: { size: 16 } } }
        },
        plugins: {
          title: { display: true, text: `${xKey} vs ${yKey} (Bubble Chart)`, font: { family: 'Roboto', size: 18 } },
          tooltip: { backgroundColor: '#333', titleFont: { family: 'Roboto', size: 16 }, bodyFont: { family: 'Roboto', size: 14 } }
        }
      }
    };
  }

      function buildAreaChart(data, xKey, yKey) {
        const points = [];
        data.forEach(row => {
          const xVal = parseFloat(getCellValue(row, xKey));
          const yVal = parseFloat(getCellValue(row, yKey));
          if (!isNaN(xVal) && !isNaN(yVal)) points.push({ x: xVal, y: yVal });
        });
        points.sort((a, b) => a.x - b.x);
        return {
          type: 'line',
          data: {
            datasets: [{
              label: `${xKey} vs ${yKey} (Area Chart)`,
              data: points,
              fill: true,
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: 'rgba(75, 192, 192, 0.3)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { type: 'linear', position: 'bottom', title: { display: true, text: xKey, font: { size: 16 } } },
              y: { beginAtZero: true, title: { display: true, text: yKey, font: { size: 16 } } }
            },
            plugins: {
              title: { display: true, text: `${xKey} vs ${yKey} (Area Chart)`, font: { family: 'Roboto', size: 18 } },
              tooltip: { backgroundColor: '#333', titleFont: { family: 'Roboto', size: 16 }, bodyFont: { family: 'Roboto', size: 14 } }
            }
          }
        };
      }

      // Modernized Scatter Chart
      function buildScatterConfig(data, xKey, yKey) {
      const points = [];
      for (let i = 0; i < data.length && i < 300; i++) {
        const xVal = parseFloat(getCellValue(data[i], xKey));
        const yVal = parseFloat(getCellValue(data[i], yKey));
        if (!isNaN(xVal) && !isNaN(yVal)) points.push({ x: xVal, y: yVal });
      }
      return {
        type: 'scatter',
        data: {
          datasets: [{
            label: `${xKey} vs ${yKey}`,
            data: points,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 1500, easing: 'easeOutBounce' },
          plugins: {
            tooltip: {
              backgroundColor: '#333',
              titleFont: { family: 'Roboto', size: 16 },
              bodyFont: { family: 'Roboto', size: 14 }
            },
            legend: { labels: { font: { family: 'Roboto', size: 14 } } },
            title: { display: true, text: `${xKey} vs ${yKey} (Scatter Plot)`, font: { family: 'Roboto', size: 18 } }
          },
          scales: {
            x: { type: 'linear', position: 'bottom', title: { display: true, text: xKey, font: { size: 16 } }, grid: { display: false } },
            y: { beginAtZero: true, title: { display: true, text: yKey, font: { size: 16 } }, grid: { color: '#eee' } }
          }
        }
      };
    }

  function buildLineConfig(data, xKey, yKey) {
    const points = [];
    data.forEach(row => {
      const xVal = parseFloat(getCellValue(row, xKey));
      const yVal = parseFloat(getCellValue(row, yKey));
      if (!isNaN(xVal) && !isNaN(yVal)) points.push({ x: xVal, y: yVal });
    });
    points.sort((a, b) => a.x - b.x);
    return {
      type: 'line',
      data: {
        datasets: [{
          label: `${xKey} vs ${yKey}`,
          data: points,
          fill: false,
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        scales: {
          x: { type: 'linear', position: 'bottom', title: { display: true, text: xKey } },
          y: { beginAtZero: true, title: { display: true, text: yKey } }
        },
        plugins: { title: { display: true, text: `${xKey} vs ${yKey} (Line Chart)` } }
      }
    };
  }

  function buildHistogramConfig(data, colKey) {
const values = [];
data.forEach(row => {
  const val = parseFloat(getCellValue(row, colKey));
  if (!isNaN(val)) values.push(val);
});

if (!values.length) {
  return {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: { plugins: { title: { display: true, text: `No numeric data for ${colKey}` } } }
  };
}

// Determine bins
const min = Math.min(...values);
const max = Math.max(...values);
const binCount = 10;
const binSize = (max - min) / binCount;
const bins = new Array(binCount).fill(0);

values.forEach(val => {
  let binIndex = Math.floor((val - min) / binSize);
  if (binIndex === binCount) binIndex--; // edge case
  bins[binIndex]++;
});

const labels = [];
for (let i = 0; i < binCount; i++) {
  const rangeStart = (min + i * binSize).toFixed(1);
  const rangeEnd = (min + (i + 1) * binSize).toFixed(1);
  labels.push(`${rangeStart} - ${rangeEnd}`);
}

return {
  type: 'bar',
  data: {
    labels: labels,
    datasets: [{
      label: `Histogram of ${colKey}`,
      data: bins,
      backgroundColor: function(context) {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) {
          return 'rgba(153, 102, 255, 0.6)';
        }
        // Create a vertical gradient
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(153, 102, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(153, 102, 255, 0.4)');
        return gradient;
      },
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1,
      borderRadius: 5 // Rounded corners (Chart.js v3+)
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1500,
      easing: 'easeOutBounce'
    },
    plugins: {
      tooltip: {
        backgroundColor: '#333',
        titleFont: { family: 'Roboto', size: 16 },
        bodyFont: { family: 'Roboto', size: 14 }
      },
      title: {
        display: true,
        text: `Histogram of ${colKey}`,
        font: { family: 'Roboto', size: 18 }
      }
    },
    scales: {
      x: {
        title: { display: true, text: colKey, font: { size: 16 } },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Frequency', font: { size: 16 } },
        grid: { color: '#eee' }
      }
    }
  }
};
}


  // Modernized Bar Chart for Categorical X, Numeric Y with Gradient fill and rounded corners
  function buildBarCatXNumericY(data, xKey, yKey) {
    const pivot = {};
    data.forEach(row => {
      const xVal = getCellValue(row, xKey) || 'Undefined';
      const yVal = parseFloat(getCellValue(row, yKey));
      if (!isNaN(yVal)) {
        if (!pivot[xVal]) pivot[xVal] = [];
        pivot[xVal].push(yVal);
      }
    });
    const labels = Object.keys(pivot).sort();
    const averages = labels.map(xVal => {
      const arr = pivot[xVal];
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    });

    return {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `Avg of ${yKey}`,
          data: averages,
          backgroundColor: function(context) {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) {
              return 'rgba(75, 192, 192, 0.5)';
            }
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(75, 192, 192, 0.8)');
            gradient.addColorStop(1, 'rgba(75, 192, 192, 0.2)');
            return gradient;
          },
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1500, easing: 'easeOutBounce' },
        plugins: {
          tooltip: {
            backgroundColor: '#333',
            titleFont: { family: 'Roboto', size: 16 },
            bodyFont: { family: 'Roboto', size: 14 }
          },
          legend: {
            labels: { font: { family: 'Roboto', size: 14 } },
            onClick: (e, legendItem, legend) => {
              const index = legendItem.datasetIndex;
              const ci = legend.chart;
              ci.toggleDataVisibility(index);
              ci.update();
            }
          },
          title: { display: true, text: `${xKey} vs Average ${yKey}`, font: { family: 'Roboto', size: 18 } }
        },
        scales: {
          x: { title: { display: true, text: xKey, font: { size: 16 } }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: `Avg(${yKey})`, font: { size: 16 } }, grid: { color: '#eee' } }
        }
      }
    };
  }

  function buildPieCatXCatY(data, xKey, yKey) {
const counts = {};
data.forEach(row => {
  const xVal = getCellValue(row, xKey) || 'Undefined';
  counts[xVal] = (counts[xVal] || 0) + 1;
});
const labels = Object.keys(counts);
const values = Object.values(counts);

// Generate an array of colors using HSL (customize as needed)
const bgColors = labels.map((_, i) => `hsl(${(i * 40) % 360}, 70%, 50%)`);

return {
  type: 'pie',
  data: {
    labels: labels,
    datasets: [{
      label: `Frequency of ${xKey}`,
      data: values,
      backgroundColor: bgColors,
      borderColor: '#fff',
      borderWidth: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateRotate: true,
      duration: 1500,
      easing: 'easeOutBounce'
    },
    plugins: {
      tooltip: {
        backgroundColor: '#333',
        titleFont: { family: 'Roboto', size: 16 },
        bodyFont: { family: 'Roboto', size: 14 }
      },
      legend: {
        labels: {
          font: { family: 'Roboto', size: 14 }
        }
      },
      title: {
        display: true,
        text: `${xKey} Frequency (Pie Chart)`,
        font: { family: 'Roboto', size: 18 }
      }
    }
  }
};
}


  function buildStackedBarCatXNumericY(data, xKey, yKey) {
    const pivot = {};
    data.forEach(row => {
      const xVal = getCellValue(row, xKey) || 'Undefined';
      const yVal = getCellValue(row, yKey) || 'Undefined';
      if (!pivot[xVal]) pivot[xVal] = {};
      pivot[xVal][yVal] = (pivot[xVal][yVal] || 0) + 1;
    });
    const xLabels = Object.keys(pivot).sort();
    const yCatsSet = new Set();
    xLabels.forEach(xv => { Object.keys(pivot[xv]).forEach(yc => yCatsSet.add(yc)); });
    const yCats = Array.from(yCatsSet);
    const datasets = yCats.map((cat, idx) => ({
      label: cat,
      data: xLabels.map(xv => pivot[xv][cat] || 0),
      backgroundColor: `hsl(${(idx * 40) % 360}, 70%, 50%)`
    }));
    return {
      type: 'bar',
      data: { labels: xLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        scales: {
          x: { stacked: true, title: { display: true, text: xKey } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: yKey } }
        },
        plugins: { title: { display: true, text: `${xKey} vs ${yKey} (Stacked Bar)` } }
      }
    };
  }

  function buildBarNumericXCatY(data, xKey, yKey) {
    const pivot = {};
    data.forEach(row => {
      const xVal = getCellValue(row, xKey) || 'Undefined';
      const yVal = getCellValue(row, yKey) || 'Undefined';
      if (!pivot[xVal]) pivot[xVal] = {};
      pivot[xVal][yVal] = (pivot[xVal][yVal] || 0) + 1;
    });
    const labels = Object.keys(pivot).sort((a, b) => parseFloat(a) - parseFloat(b));
    const counts = labels.map(xVal => Object.values(pivot[xVal]).reduce((a, b) => a + b, 0));
    return {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `Count`,
          data: counts,
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        scales: {
          x: { title: { display: true, text: xKey } },
          y: { beginAtZero: true, title: { display: true, text: 'Count' } }
        },
        plugins: { title: { display: true, text: `${xKey} Frequency` } }
      }
    };
  }

  function buildStackedBarNumericXCatY(data, xKey, yKey) {
    const pivot = {};
    data.forEach(row => {
      const xVal = getCellValue(row, xKey) || 'Undefined';
      const yVal = getCellValue(row, yKey) || 'Undefined';
      if (!pivot[xVal]) pivot[xVal] = {};
      pivot[xVal][yVal] = (pivot[xVal][yVal] || 0) + 1;
    });
    const xLabels = Object.keys(pivot).sort((a, b) => parseFloat(a) - parseFloat(b));
    const yCatsSet = new Set();
    xLabels.forEach(xVal => { Object.keys(pivot[xVal]).forEach(cat => yCatsSet.add(cat)); });
    const yCats = Array.from(yCatsSet);
    const datasets = yCats.map((cat, idx) => ({
      label: cat,
      data: xLabels.map(xVal => pivot[xVal][cat] || 0),
      backgroundColor: `hsl(${(idx * 40) % 360}, 70%, 50%)`
    }));
    return {
      type: 'bar',
      data: { labels: xLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        scales: {
          x: { stacked: true, title: { display: true, text: xKey } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Count' } }
        },
        plugins: { title: { display: true, text: `${xKey} vs ${yKey} (Stacked Bar)` } }
      }
    };
  }

  function buildStackedBarCatXCatY(data, xKey, yKey) {
    const pivot = {};
    data.forEach(row => {
      const xVal = getCellValue(row, xKey) || 'Undefined';
      const yVal = getCellValue(row, yKey) || 'Undefined';
      if (!pivot[xVal]) pivot[xVal] = {};
      pivot[xVal][yVal] = (pivot[xVal][yVal] || 0) + 1;
    });
    const xLabels = Object.keys(pivot).sort();
    const yCatsSet = new Set();
    xLabels.forEach(xVal => { Object.keys(pivot[xVal]).forEach(cat => yCatsSet.add(cat)); });
    const yCats = Array.from(yCatsSet);
    const datasets = yCats.map((cat, idx) => ({
      label: cat,
      data: xLabels.map(xVal => pivot[xVal][cat] || 0),
      backgroundColor: `hsl(${(idx * 40) % 360}, 70%, 50%)`
    }));
    return {
      type: 'bar',
      data: { labels: xLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        scales: {
          x: { stacked: true, title: { display: true, text: xKey } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: yKey } }
        },
        plugins: { title: { display: true, text: `${xKey} vs ${yKey} (Stacked Bar)` } }
      }
    };
  }

  function buildPieCatXCatY(data, xKey, yKey) {
    const counts = {};
    data.forEach(row => {
      const xVal = getCellValue(row, xKey) || 'Undefined';
      counts[xVal] = (counts[xVal] || 0) + 1;
    });
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const bgColors = labels.map((_, i) => `hsl(${(i * 40) % 360}, 70%, 50%)`);
    return {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: `Frequency of ${xKey}`,
          data: values,
          backgroundColor: bgColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        plugins: { title: { display: true, text: `${xKey} Frequency (Pie Chart)` } }
      }
    };
  }

  /*************** Data Analysis Functions ***************/
  // Compute Descriptive Statistics for numeric columns
  function computeDescriptiveStats() {
    // Identify numeric columns from currentColumns
    const stats = {};
    currentColumns.forEach(col => {
      if (determineColType(jsonData, col) === 'numeric') {
        const values = [];
        if (dataFormat === 'excel') {
          jsonData.slice(1).forEach(row => {
            const val = parseFloat(row[globalHeaders.indexOf(col)]);
            if (!isNaN(val)) values.push(val);
          });
        } else {
          jsonData.forEach(row => {
            const val = parseFloat(row[col]);
            if (!isNaN(val)) values.push(val);
          });
        }
        if (values.length) {
          values.sort((a, b) => a - b);
          const count = values.length;
          const sum = values.reduce((a, b) => a + b, 0);
          const mean = (sum / count).toFixed(2);
          const median = count % 2 === 0 ? ((values[count/2 - 1] + values[count/2]) / 2).toFixed(2) : values[Math.floor(count/2)].toFixed(2);
          const min = Math.min(...values);
          const max = Math.max(...values);
          // Standard Deviation (sample)
          const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (count - 1);
          const stdDev = Math.sqrt(variance).toFixed(2);
          stats[col] = { count, mean, median, min, max, stdDev };
        }
      }
    });
    return stats;
  }

  // Compute correlation matrix for numeric columns
  function computeCorrelationMatrix() {
    const numericCols = currentColumns.filter(col => determineColType(jsonData, col) === 'numeric');
    const matrix = {};
    // Helper to compute mean and stdDev for a column
    const colStats = {};
    numericCols.forEach(col => {
      const values = [];
      if (dataFormat === 'excel') {
        jsonData.slice(1).forEach(row => {
          const val = parseFloat(row[globalHeaders.indexOf(col)]);
          if (!isNaN(val)) values.push(val);
        });
      } else {
        jsonData.forEach(row => {
          const val = parseFloat(row[col]);
          if (!isNaN(val)) values.push(val);
        });
      }
      if (values.length) {
        const count = values.length;
        const mean = values.reduce((a, b) => a + b, 0) / count;
        const stdDev = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (count - 1));
        colStats[col] = { values, mean, stdDev };
      }
    });
    // Function to compute correlation between two arrays
    function correlation(arr1, arr2, mean1, mean2, stdDev1, stdDev2) {
      let cov = 0;
      const n = arr1.length;
      for (let i = 0; i < n; i++) {
        cov += (arr1[i] - mean1) * (arr2[i] - mean2);
      }
      cov = cov / (n - 1);
      return (stdDev1 && stdDev2) ? (cov / (stdDev1 * stdDev2)).toFixed(2) : 0;
    }
    numericCols.forEach(col1 => {
      matrix[col1] = {};
      numericCols.forEach(col2 => {
        if (col1 === col2) {
          matrix[col1][col2] = 1;
        } else {
          matrix[col1][col2] = correlation(colStats[col1].values, colStats[col2].values, colStats[col1].mean, colStats[col2].mean, colStats[col1].stdDev, colStats[col2].stdDev);
        }
      });
    });
    return matrix;
  }

  // Render analysis results in the Data Analysis tab
  function showDescriptiveStats() {
    const stats = computeDescriptiveStats();
    let html = "<h6>Descriptive Statistics</h6>";
    html += "<table class='table table-sm table-bordered'><thead><tr><th>Column</th><th>Count</th><th>Mean</th><th>Median</th><th>Min</th><th>Max</th><th>Std Dev</th></tr></thead><tbody>";
    for (const col in stats) {
      const s = stats[col];
      html += `<tr><td>${col}</td><td>${s.count}</td><td>${s.mean}</td><td>${s.median}</td><td>${s.min}</td><td>${s.max}</td><td>${s.stdDev}</td></tr>`;
    }
    html += "</tbody></table>";
    document.getElementById('analysisResults').innerHTML = html;
  }

  function showCorrelationMatrix() {
    const matrix = computeCorrelationMatrix();
    const numericCols = Object.keys(matrix);
    let html = "<h6>Correlation Matrix</h6>";
    html += "<table class='table table-sm table-bordered'><thead><tr><th></th>";
    numericCols.forEach(col => { html += `<th>${col}</th>`; });
    html += "</tr></thead><tbody>";
    numericCols.forEach(rowCol => {
      html += `<tr><th>${rowCol}</th>`;
      numericCols.forEach(col => {
        html += `<td>${matrix[rowCol][col]}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    document.getElementById('analysisResults').innerHTML = html;
  }

  /*************** Data Analysis Tab: Button Setup ***************/
  // In the Data Analysis tab, two buttons call showDescriptiveStats() and showCorrelationMatrix().
  // They are defined in the HTML in the "analysis" tab content.

    /*************** Pivot Table Functionality ***************/
  function generatePivotTable() {
    const groupByCol = document.getElementById('pivotGroupBy').value;
    const valueCol = document.getElementById('pivotValue').value;
    const agg = document.getElementById('pivotFunc').value;
    let pivot = {};
    let rows;
    if (dataFormat === 'excel') {
      rows = jsonData.slice(1);
    } else {
      rows = jsonData;
    }
    rows.forEach(row => {
      const group = dataFormat === 'excel' ? row[globalHeaders.indexOf(groupByCol)] : row[groupByCol];
      let value = dataFormat === 'excel' ? parseFloat(row[globalHeaders.indexOf(valueCol)]) : parseFloat(row[valueCol]);
      if (agg === 'count') {
        if (!pivot[group]) pivot[group] = 0;
        pivot[group]++;
      } else if (agg === 'sum') {
        if (!pivot[group]) pivot[group] = 0;
        pivot[group] += isNaN(value) ? 0 : value;
      } else if (agg === 'avg') {
        if (!pivot[group]) pivot[group] = { sum: 0, count: 0 };
        pivot[group].sum += isNaN(value) ? 0 : value;
        pivot[group].count++;
      }
    });
    if (agg === 'avg') {
      for (const key in pivot) {
        pivot[key] = pivot[key].count ? (pivot[key].sum / pivot[key].count).toFixed(2) : 0;
      }
    }
    let html = '<table class="table table-sm table-bordered"><thead><tr><th>' + groupByCol + '</th><th>' + agg.toUpperCase() + ' of ' + valueCol + '</th></tr></thead><tbody>';
    for (const key in pivot) {
      html += `<tr><td>${key}</td><td>${pivot[key]}</td></tr>`;
    }
    html += '</tbody></table>';
    document.getElementById('pivotResults').innerHTML = html;
  }