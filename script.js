document.addEventListener("DOMContentLoaded", () => {
  // Theme Toggle
  const themeToggle = document.getElementById("theme-toggle");
  const root = document.documentElement;
  
  // Load saved theme or check preferences
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    root.classList.add("light-theme");
  }

  themeToggle.addEventListener("click", () => {
    root.classList.toggle("light-theme");
    const isLight = root.classList.contains("light-theme");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  // Tab Controls
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Remove active states
      tabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      panels.forEach(p => p.classList.remove("active"));

      // Set active state
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      const targetId = tab.getAttribute("aria-controls");
      document.getElementById(targetId).classList.add("active");

      // Trigger recalculation if schedule or compare tabs are loaded
      if (targetId === "schedule-tab") {
        updateAmortizationSchedule();
      } else if (targetId === "compare-tab") {
        updateLoanComparison();
      }
    });
  });

  // Main Calculator Inputs
  const principalNum = document.getElementById("principal-number");
  const principalSlider = document.getElementById("principal-slider");
  const rateNum = document.getElementById("rate-number");
  const rateSlider = document.getElementById("rate-slider");
  const tenureNum = document.getElementById("tenure-number");
  const tenureSlider = document.getElementById("tenure-slider");

  // Tenure Toggle
  const toggleYears = document.getElementById("toggle-years");
  const toggleMonths = document.getElementById("toggle-months");
  const tenureUnitSuffix = document.getElementById("tenure-unit-suffix");
  const sliderMinTenure = document.getElementById("slider-min-tenure");
  const sliderMidTenure = document.getElementById("slider-mid-tenure");
  const sliderMaxTenure = document.getElementById("slider-max-tenure");
  
  let isTenureYears = true; // State for tenure mode

  // Main Outputs
  const emiValue = document.getElementById("emi-value");
  const principalDisplay = document.getElementById("principal-display");
  const interestValue = document.getElementById("interest-value");
  const totalValue = document.getElementById("total-value");

  // Donut Chart Elements
  const donutSegmentPrincipal = document.getElementById("donut-segment-principal");
  const donutSegmentInterest = document.getElementById("donut-segment-interest");
  const chartCenterVal = document.getElementById("chart-center-val");
  const legendPrincipalPct = document.getElementById("legend-principal-pct");
  const legendInterestPct = document.getElementById("legend-interest-pct");

  // Amortization Schedule
  const viewYearly = document.getElementById("view-yearly");
  const viewMonthly = document.getElementById("view-monthly");
  const periodHeader = document.getElementById("period-header");
  const scheduleTbody = document.getElementById("schedule-tbody");
  const downloadCsvBtn = document.getElementById("download-csv-btn");
  
  let isScheduleYearly = true; // State for schedule breakdown mode

  // Compare Loan Inputs
  const compPrincipalA = document.getElementById("comp-principal-a");
  const compRateA = document.getElementById("comp-rate-a");
  const compTenureA = document.getElementById("comp-tenure-a");

  const compPrincipalB = document.getElementById("comp-principal-b");
  const compRateB = document.getElementById("comp-rate-b");
  const compTenureB = document.getElementById("comp-tenure-b");

  // Helper: Format Currency (INR)
  function formatINR(value, includeDecimals = false) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: includeDecimals ? 2 : 0,
    }).format(value);
  }

  // Helper: Sync Slider with Numeric Input
  function setupBiDirectionalSync(slider, number, onUpdate) {
    slider.addEventListener("input", (e) => {
      number.value = e.target.value;
      onUpdate();
    });

    number.addEventListener("input", (e) => {
      let val = Number(e.target.value);
      const min = Number(number.min);
      const max = Number(number.max);

      // Simple validation bounds check
      if (val < min) val = min;
      if (val > max) val = max;

      slider.value = val;
      onUpdate();
    });
  }

  // Synchronize inputs
  setupBiDirectionalSync(principalSlider, principalNum, calculateMainEmi);
  setupBiDirectionalSync(rateSlider, rateNum, calculateMainEmi);
  setupBiDirectionalSync(tenureSlider, tenureNum, calculateMainEmi);

  // Tenure Mode Toggle (Years vs Months)
  toggleYears.addEventListener("click", () => {
    if (isTenureYears) return;
    isTenureYears = true;
    toggleYears.classList.add("active");
    toggleMonths.classList.remove("active");
    tenureUnitSuffix.textContent = "Yrs";
    
    // Convert months to years
    let currentVal = Math.round(Number(tenureNum.value) / 12);
    if (currentVal < 1) currentVal = 1;
    if (currentVal > 30) currentVal = 30;

    // Adjust attributes
    tenureNum.min = "1";
    tenureNum.max = "30";
    tenureNum.step = "1";
    tenureNum.value = currentVal;

    tenureSlider.min = "1";
    tenureSlider.max = "30";
    tenureSlider.step = "1";
    tenureSlider.value = currentVal;

    sliderMinTenure.textContent = "1 Yr";
    sliderMidTenure.textContent = "15 Yrs";
    sliderMaxTenure.textContent = "30 Yrs";

    calculateMainEmi();
  });

  toggleMonths.addEventListener("click", () => {
    if (!isTenureYears) return;
    isTenureYears = false;
    toggleMonths.classList.add("active");
    toggleYears.classList.remove("active");
    tenureUnitSuffix.textContent = "Mo";

    // Convert years to months
    let currentVal = Number(tenureNum.value) * 12;
    if (currentVal < 12) currentVal = 12;
    if (currentVal > 360) currentVal = 360;

    // Adjust attributes
    tenureNum.min = "12";
    tenureNum.max = "360";
    tenureNum.step = "1";
    tenureNum.value = currentVal;

    tenureSlider.min = "12";
    tenureSlider.max = "360";
    tenureSlider.step = "1";
    tenureSlider.value = currentVal;

    sliderMinTenure.textContent = "12 Mo";
    sliderMidTenure.textContent = "180 Mo";
    sliderMaxTenure.textContent = "360 Mo";

    calculateMainEmi();
  });

  // Core Math: Calculate EMI
  function calculateEmiValues(principal, annualRate, months) {
    const monthlyRate = annualRate / 12 / 100;

    if (monthlyRate === 0) {
      const emi = principal / months;
      const totalPayment = principal;
      const totalInterest = 0;
      return { emi, totalPayment, totalInterest };
    }

    const factor = Math.pow(1 + monthlyRate, months);
    const emi = (principal * monthlyRate * factor) / (factor - 1);
    const totalPayment = emi * months;
    const totalInterest = totalPayment - principal;

    return { emi, totalPayment, totalInterest };
  }

  // Donut Chart updates
  function updateDonutChart(principal, totalInterest) {
    const total = principal + totalInterest;
    if (total <= 0) return;

    const principalPct = (principal / total) * 100;
    const interestPct = (totalInterest / total) * 100;

    legendPrincipalPct.textContent = `${principalPct.toFixed(1)}%`;
    legendInterestPct.textContent = `${interestPct.toFixed(1)}%`;
    chartCenterVal.textContent = `${interestPct.toFixed(0)}%`;

    const circumference = 439.82; // 2 * pi * r (r=70)
    const principalLength = (principalPct / 100) * circumference;
    const interestLength = (interestPct / 100) * circumference;

    // Segment A (Principal): starts at 0
    donutSegmentPrincipal.style.strokeDasharray = `${principalLength} ${circumference - principalLength}`;
    
    // Segment B (Interest): starts after Principal
    donutSegmentInterest.style.strokeDasharray = `${interestLength} ${circumference - interestLength}`;
    donutSegmentInterest.style.strokeDashoffset = `-${principalLength}`;
  }

  // Calculate Main EMI and update Dashboard UI
  function calculateMainEmi() {
    const principal = Number(principalNum.value) || 0;
    const annualRate = Number(rateNum.value) || 0;
    let months = Number(tenureNum.value) || 0;

    if (isTenureYears) {
      months = months * 12;
    }

    if (principal <= 0 || months <= 0) {
      emiValue.textContent = formatINR(0);
      principalDisplay.textContent = formatINR(0);
      interestValue.textContent = formatINR(0);
      totalValue.textContent = formatINR(0);
      updateDonutChart(0, 0);
      return;
    }

    const { emi, totalPayment, totalInterest } = calculateEmiValues(principal, annualRate, months);

    emiValue.textContent = formatINR(emi);
    principalDisplay.textContent = formatINR(principal);
    interestValue.textContent = formatINR(totalInterest);
    totalValue.textContent = formatINR(totalPayment);

    updateDonutChart(principal, totalInterest);
  }

  // Amortization Schedule Calculation
  function calculateAmortizationDetails() {
    const principal = Number(principalNum.value) || 0;
    const annualRate = Number(rateNum.value) || 0;
    let months = Number(tenureNum.value) || 0;

    if (isTenureYears) {
      months = months * 12;
    }

    const { emi } = calculateEmiValues(principal, annualRate, months);
    const monthlyRate = annualRate / 12 / 100;
    
    let outstandingBalance = principal;
    const schedule = [];

    for (let m = 1; m <= months; m++) {
      const interestPaid = outstandingBalance * monthlyRate;
      let principalPaid = emi - interestPaid;

      // Handle final month floating point rounding
      if (m === months || principalPaid > outstandingBalance) {
        principalPaid = outstandingBalance;
      }

      outstandingBalance -= principalPaid;
      if (outstandingBalance < 0) outstandingBalance = 0;

      schedule.push({
        month: m,
        payment: principalPaid + interestPaid,
        principalPaid,
        interestPaid,
        balance: outstandingBalance
      });
    }

    return schedule;
  }

  // Render Amortization Schedule Table
  function updateAmortizationSchedule() {
    const schedule = calculateAmortizationDetails();
    scheduleTbody.innerHTML = "";

    if (schedule.length === 0) {
      scheduleTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No data available. Adjust loan parameters in the Calculator tab.</td></tr>`;
      return;
    }

    if (isScheduleYearly) {
      periodHeader.textContent = "Year";
      
      // Group by 12 months
      let yearCount = 1;
      let yearlyPrincipal = 0;
      let yearlyInterest = 0;
      let yearlyTotal = 0;
      let balanceAtYearEnd = 0;

      schedule.forEach((item, index) => {
        yearlyPrincipal += item.principalPaid;
        yearlyInterest += item.interestPaid;
        yearlyTotal += item.payment;
        balanceAtYearEnd = item.balance;

        // If end of a year or end of the schedule
        if ((index + 1) % 12 === 0 || index === schedule.length - 1) {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>Year ${yearCount}</td>
            <td>${formatINR(yearlyPrincipal)}</td>
            <td>${formatINR(yearlyInterest)}</td>
            <td>${formatINR(yearlyTotal)}</td>
            <td>${formatINR(balanceAtYearEnd)}</td>
          `;
          scheduleTbody.appendChild(tr);

          // Reset sums for next year
          yearCount++;
          yearlyPrincipal = 0;
          yearlyInterest = 0;
          yearlyTotal = 0;
        }
      });
    } else {
      periodHeader.textContent = "Month";
      
      schedule.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>Month ${item.month}</td>
          <td>${formatINR(item.principalPaid)}</td>
          <td>${formatINR(item.interestPaid)}</td>
          <td>${formatINR(item.payment)}</td>
          <td>${formatINR(item.balance)}</td>
        `;
        scheduleTbody.appendChild(tr);
      });
    }
  }

  // Toggle Amortization Schedule View Mode
  viewYearly.addEventListener("click", () => {
    if (isScheduleYearly) return;
    isScheduleYearly = true;
    viewYearly.classList.add("active");
    viewMonthly.classList.remove("active");
    updateAmortizationSchedule();
  });

  viewMonthly.addEventListener("click", () => {
    if (!isScheduleYearly) return;
    isScheduleYearly = false;
    viewMonthly.classList.add("active");
    viewYearly.classList.remove("active");
    updateAmortizationSchedule();
  });

  // Export Amortization Table to CSV
  downloadCsvBtn.addEventListener("click", () => {
    const schedule = calculateAmortizationDetails();
    if (schedule.length === 0) return;

    let csvContent = "";
    
    if (isScheduleYearly) {
      csvContent += "Year,Principal Paid (INR),Interest Paid (INR),Total Payment (INR),Outstanding Balance (INR)\n";
      
      let yearCount = 1;
      let yearlyPrincipal = 0;
      let yearlyInterest = 0;
      let yearlyTotal = 0;
      let balanceAtYearEnd = 0;

      schedule.forEach((item, index) => {
        yearlyPrincipal += item.principalPaid;
        yearlyInterest += item.interestPaid;
        yearlyTotal += item.payment;
        balanceAtYearEnd = item.balance;

        if ((index + 1) % 12 === 0 || index === schedule.length - 1) {
          csvContent += `${yearCount},${yearlyPrincipal.toFixed(2)},${yearlyInterest.toFixed(2)},${yearlyTotal.toFixed(2)},${balanceAtYearEnd.toFixed(2)}\n`;
          yearCount++;
          yearlyPrincipal = 0;
          yearlyInterest = 0;
          yearlyTotal = 0;
        }
      });
    } else {
      csvContent += "Month,Principal Paid (INR),Interest Paid (INR),Total Payment (INR),Outstanding Balance (INR)\n";
      schedule.forEach(item => {
        csvContent += `${item.month},${item.principalPaid.toFixed(2)},${item.interestPaid.toFixed(2)},${item.payment.toFixed(2)},${item.balance.toFixed(2)}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const fileName = isScheduleYearly ? "repayment_schedule_yearly.csv" : "repayment_schedule_monthly.csv";
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Compare Tab Calculations
  function updateLoanComparison() {
    // Inputs for Option A
    const principalA = Number(compPrincipalA.value) || 0;
    const rateA = Number(compRateA.value) || 0;
    const tenureA = (Number(compTenureA.value) || 0) * 12;

    // Inputs for Option B
    const principalB = Number(compPrincipalB.value) || 0;
    const rateB = Number(compRateB.value) || 0;
    const tenureB = (Number(compTenureB.value) || 0) * 12;

    // Calculators
    const loanA = calculateEmiValues(principalA, rateA, tenureA);
    const loanB = calculateEmiValues(principalB, rateB, tenureB);

    // Displays
    document.getElementById("comp-emi-a").textContent = formatINR(loanA.emi);
    document.getElementById("comp-emi-b").textContent = formatINR(loanB.emi);

    document.getElementById("comp-principal-val-a").textContent = formatINR(principalA);
    document.getElementById("comp-principal-val-b").textContent = formatINR(principalB);

    document.getElementById("comp-interest-a").textContent = formatINR(loanA.totalInterest);
    document.getElementById("comp-interest-b").textContent = formatINR(loanB.totalInterest);

    document.getElementById("comp-total-a").textContent = formatINR(loanA.totalPayment);
    document.getElementById("comp-total-b").textContent = formatINR(loanB.totalPayment);

    // Compare deltas
    const emiDiff = loanA.emi - loanB.emi;
    const principalDiff = principalA - principalB;
    const interestDiff = loanA.totalInterest - loanB.totalInterest;
    const totalDiff = loanA.totalPayment - loanB.totalPayment;

    // UI Formatting for differences
    formatDiffCell("comp-emi-diff", emiDiff);
    formatDiffCell("comp-principal-diff", principalDiff);
    formatDiffCell("comp-interest-diff", interestDiff);
    formatDiffCell("comp-total-diff", totalDiff);

    // Verdict box summary text
    const verdictBox = document.getElementById("comparison-verdict");
    if (principalA <= 0 || principalB <= 0 || tenureA <= 0 || tenureB <= 0) {
      verdictBox.innerHTML = `<span class="verdict-icon">ℹ️</span><span class="verdict-text">Enter positive values in both Option A and Option B panels to view comparison analytics.</span>`;
      return;
    }

    let verdictHTML = "";
    if (Math.abs(totalDiff) < 1) {
      verdictHTML = `<span class="verdict-icon">⚖️</span><span class="verdict-text">Both loan options result in the exact same total repayment cost.</span>`;
    } else {
      const betterOption = totalDiff > 0 ? "Option B" : "Option A";
      const savings = Math.abs(totalDiff);
      const interestSavings = Math.abs(interestDiff);
      
      verdictHTML = `
        <span class="verdict-icon">💡</span>
        <div class="verdict-text">
          <p><strong>${betterOption}</strong> is financially cheaper overall, saving you <strong>${formatINR(savings)}</strong> in total payments.</p>
          <p style="font-size: 0.85rem; margin-top: 4px; opacity: 0.85;">
            By choosing ${betterOption}, you will pay ${formatINR(interestSavings)} less in interest charges over the tenure.
          </p>
        </div>
      `;
    }
    verdictBox.innerHTML = verdictHTML;
  }

  function formatDiffCell(elementId, diff) {
    const el = document.getElementById(elementId);
    if (Math.abs(diff) < 0.01) {
      el.textContent = "No difference";
      el.className = "highlight-val";
      return;
    }

    const sign = diff > 0 ? "+" : "-";
    const absDiff = Math.abs(diff);
    el.textContent = `${sign} ${formatINR(absDiff)}`;
    
    // Highlight colors
    if (elementId === "comp-interest-diff" || elementId === "comp-total-diff" || elementId === "comp-emi-diff") {
      // For payments and interests, higher (+) is negative for the pocket, lower (-) is a savings
      if (diff > 0) {
        el.className = "highlight-val highlight-rose";
        // Append badge if not already added programmatically elsewhere
      } else {
        el.className = "highlight-val highlight-teal";
      }
    } else {
      el.className = "highlight-val";
    }
  }

  // Setup live listeners on comparison fields
  const compareInputs = [
    compPrincipalA, compRateA, compTenureA,
    compPrincipalB, compRateB, compTenureB
  ];

  compareInputs.forEach(input => {
    input.addEventListener("input", updateLoanComparison);
  });

  // Form submit intercept to prevent reloads on form buttons
  const mainForm = document.getElementById("emi-form");
  if (mainForm) {
    mainForm.addEventListener("submit", (e) => {
      e.preventDefault();
      calculateMainEmi();
    });
  }

  // Initial Calculation
  calculateMainEmi();
});
