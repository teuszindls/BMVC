(function() {
  const STORAGE_KEY = 'bmvc_finance_records';
  const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  function getRecords() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) || [];
    } catch (err) {
      console.warn('finance: registro inválido no storage', err);
      return [];
    }
  }

  function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function parseAmount(value) {
    if (typeof value !== 'string') return Number(value) || 0;
    return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
  }

  function formatCurrency(value) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function normalizeDate(value) {
    const date = new Date(value);
    if (isNaN(date)) {
      return new Date().toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }

  function calculateSummary(records) {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth();

    const incomesByMonth = new Array(12).fill(0);
    const expensesByMonth = new Array(12).fill(0);
    let totalIncome = 0;
    let totalExpense = 0;

    records.forEach((record) => {
      const amount = parseAmount(record.amount);
      const type = record.type === 'expense' ? 'expense' : 'income';
      const date = new Date(record.date);
      const monthIndex = isNaN(date.getTime()) ? currentMonth : date.getMonth();
      const recordYear = isNaN(date.getTime()) ? year : date.getFullYear();

      if (type === 'income') {
        totalIncome += amount;
        if (recordYear === year) {
          incomesByMonth[monthIndex] += amount;
        }
      } else {
        totalExpense += amount;
        if (recordYear === year) {
          expensesByMonth[monthIndex] += amount;
        }
      }
    });

    const monthlyIncome = incomesByMonth[currentMonth] || 0;
    const annualIncome = incomesByMonth.reduce((sum, value) => sum + value, 0);
    const balance = totalIncome - totalExpense;
    const monthlyNet = incomesByMonth.map((income, index) => income - expensesByMonth[index]);

    return {
      totalIncome,
      totalExpense,
      currentBalance: balance,
      monthlyIncome,
      annualIncome,
      monthlyNet,
      incomesByMonth,
      expensesByMonth,
      recordCount: records.length,
      monthLabels: MONTH_LABELS,
    };
  }

  function updateDashboard() {
    const records = getRecords();
    const summary = calculateSummary(records);

    const monthlyIncomeEl = document.getElementById('monthlyIncome');
    const annualIncomeEl = document.getElementById('annualIncome');
    const balanceEl = document.getElementById('currentBalance');
    const expensesEl = document.getElementById('totalExpenses');

    if (monthlyIncomeEl) monthlyIncomeEl.textContent = formatCurrency(summary.monthlyIncome);
    if (annualIncomeEl) annualIncomeEl.textContent = formatCurrency(summary.annualIncome);
    if (balanceEl) balanceEl.textContent = formatCurrency(summary.currentBalance);
    if (expensesEl) expensesEl.textContent = formatCurrency(summary.totalExpense);

    if (window.myLineChart) {
      window.myLineChart.data.labels = MONTH_LABELS;
      if (window.myLineChart.data.datasets && window.myLineChart.data.datasets[0]) {
        window.myLineChart.data.datasets[0].label = 'Saldo Mensal';
        window.myLineChart.data.datasets[0].data = summary.monthlyNet;
      }
      window.myLineChart.update();
    }

    if (window.myPieChart) {
      window.myPieChart.data.labels = ['Receita', 'Despesa'];
      if (window.myPieChart.data.datasets && window.myPieChart.data.datasets[0]) {
        window.myPieChart.data.datasets[0].data = [summary.totalIncome, summary.totalExpense];
        window.myPieChart.data.datasets[0].backgroundColor = ['#1cc88a', '#e74a3b'];
        window.myPieChart.data.datasets[0].hoverBackgroundColor = ['#17a673', '#c82333'];
      }
      window.myPieChart.update();
    }
  }

  function renderRecordRow(record) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.date}</td>
      <td>${record.type === 'expense' ? 'Despesa' : 'Receita'}</td>
      <td>${record.category || 'Sem categoria'}</td>
      <td>${record.description || 'Sem descrição'}</td>
      <td>${formatCurrency(parseAmount(record.amount))}</td>
      <td><button type="button" class="btn btn-sm btn-danger delete-record" data-id="${record.id}">Excluir</button></td>
    `;
    return row;
  }

  function renderRecordsTable() {
    const tableBody = document.getElementById('recordsTableBody');
    if (!tableBody) return;

    const records = getRecords().sort((a, b) => new Date(b.date) - new Date(a.date));
    tableBody.innerHTML = '';

    if (records.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="6" class="text-center text-muted">Nenhum registro cadastrado ainda.</td>';
      tableBody.appendChild(emptyRow);
      return;
    }

    records.forEach((record) => {
      tableBody.appendChild(renderRecordRow(record));
    });
  }

  function addRecord(record) {
    const records = getRecords();
    records.push(record);
    saveRecords(records);
    renderRecordsTable();
    updateDashboard();
  }

  function removeRecord(id) {
    const records = getRecords().filter((record) => record.id !== id);
    saveRecords(records);
    renderRecordsTable();
    updateDashboard();
  }

  function setupRecordsPage() {
    const form = document.getElementById('recordForm');
    const table = document.getElementById('recordsTable');
    const noRecordsAlert = document.getElementById('recordsEmpty');

    if (form) {
      const dateInput = document.getElementById('recordDate');
      if (dateInput) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        const description = document.getElementById('recordDescription').value.trim();
        const category = document.getElementById('recordCategory').value.trim();
        const amount = document.getElementById('recordAmount').value.trim();
        const type = document.getElementById('recordType').value;
        const date = normalizeDate(document.getElementById('recordDate').value);

        if (!amount || parseAmount(amount) <= 0) {
          alert('Informe um valor válido maior que zero.');
          return;
        }

        if (!description) {
          alert('Informe uma descrição para o registro.');
          return;
        }

        addRecord({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          description,
          category,
          amount: parseAmount(amount),
          type,
          date,
        });

        form.reset();
        if (dateInput) {
          dateInput.value = new Date().toISOString().slice(0, 10);
        }
      });
    }

    if (table) {
      table.addEventListener('click', function (event) {
        const button = event.target.closest('.delete-record');
        if (!button) return;
        const id = button.getAttribute('data-id');
        if (!id) return;
        if (confirm('Deseja excluir este registro?')) {
          removeRecord(id);
        }
      });
    }

    renderRecordsTable();
  }

  function addChartToPdf(doc, canvas, x, y, maxWidth, maxHeight) {
    if (!canvas || !canvas.toDataURL) {
      return y;
    }
    const imageData = canvas.toDataURL('image/png');
    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
    const width = canvas.width * ratio;
    const height = canvas.height * ratio;
    doc.addImage(imageData, 'PNG', x, y, width, height);
    return y + height;
  }

  function createReportTable(doc, records, startY, margin) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const lineHeight = 14;
    const colX = [margin, margin + 70, margin + 140, margin + 260, margin + 460];
    const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor'];

    doc.setFontSize(10);
    headers.forEach((label, index) => {
      doc.text(label, colX[index], startY);
    });

    let y = startY + lineHeight;
    doc.setLineWidth(0.5);
    doc.line(margin, y - 10, 555, y - 10);

    records.forEach((record) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
        headers.forEach((label, index) => {
          doc.text(label, colX[index], y);
        });
        y += lineHeight;
        doc.line(margin, y - 10, 555, y - 10);
      }

      const dateValue = new Date(record.date);
      const dateText = !isNaN(dateValue) ? dateValue.toLocaleDateString('pt-BR') : record.date;
      const typeText = record.type === 'expense' ? 'Despesa' : 'Receita';
      const categoryText = record.category || 'Sem categoria';
      const descriptionText = record.description ? record.description.slice(0, 30) : 'Sem descrição';
      const valueText = formatCurrency(parseAmount(record.amount));

      doc.text(dateText, colX[0], y);
      doc.text(typeText, colX[1], y);
      doc.text(categoryText, colX[2], y);
      doc.text(descriptionText, colX[3], y);
      doc.text(valueText, colX[4], y);
      y += lineHeight;
    });

    return y;
  }

  function generateReportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Não foi possível gerar o PDF: biblioteca jsPDF não carregada.');
      return;
    }

    const jsPDF = window.jspdf.jsPDF;
    const records = getRecords();
    const summary = calculateSummary(records);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    let y = margin;

    doc.setFontSize(18);
    doc.text('Relatório Financeiro', margin, y);
    y += 28;

    doc.setFontSize(11);
    doc.text(`Data do relatório: ${new Date().toLocaleDateString('pt-BR')}`, margin, y);
    y += 18;
    doc.text(`Total de registros: ${records.length}`, margin, y);
    y += 24;

    doc.setFontSize(12);
    doc.text(`Saldo Atual: ${formatCurrency(summary.currentBalance)}`, margin, y);
    y += 16;
    doc.text(`Ganho Mensal: ${formatCurrency(summary.monthlyIncome)}`, margin, y);
    y += 16;
    doc.text(`Ganho Anual: ${formatCurrency(summary.annualIncome)}`, margin, y);
    y += 16;
    doc.text(`Despesas Totais: ${formatCurrency(summary.totalExpense)}`, margin, y);
    y += 26;

    const areaCanvas = document.getElementById('myAreaChart');
    if (areaCanvas) {
      y = addChartToPdf(doc, areaCanvas, margin, y, 520, 240);
      y += 20;
    }

    const pieCanvas = document.getElementById('myPieChart');
    if (pieCanvas) {
      if (y + 260 > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      y = addChartToPdf(doc, pieCanvas, margin, y, 260, 260);
      y += 20;
    }

    doc.addPage();
    y = margin;
    doc.setFontSize(14);
    doc.text('Registros', margin, y);
    y += 20;

    if (records.length === 0) {
      doc.setFontSize(12);
      doc.text('Nenhum registro cadastrado.', margin, y);
    } else {
      createReportTable(doc, records, y, margin);
    }

    doc.save('relatorio-financeiro.pdf');
  }

  function setupReportButton() {
    const reportButton = document.getElementById('reportButton');
    if (!reportButton) return;

    reportButton.addEventListener('click', function (event) {
      event.preventDefault();
      generateReportPDF();
    });
  }

  function initPage() {
    setupRecordsPage();
    setupReportButton();
    updateDashboard();
  }

  document.addEventListener('DOMContentLoaded', initPage);
})();
