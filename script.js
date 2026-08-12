var searchInput = document.getElementById("searchInput");
var themeToggleBtn = document.getElementById("themeToggleBtn");
var statusLine = document.getElementById("statusLine");
var coinListEl = document.getElementById("coinList");
var detailIcon = document.getElementById("detailIcon");
var detailName = document.getElementById("detailName");
var detailSymbol = document.getElementById("detailSymbol");
var detailPrice = document.getElementById("detailPrice");
var detailChange = document.getElementById("detailChange");
var rangeButtons = document.getElementById("rangeButtons");
var statMarketCap = document.getElementById("statMarketCap");
var statVolume = document.getElementById("statVolume");
var statHigh = document.getElementById("statHigh");
var statLow = document.getElementById("statLow");
var allCoins = [];
var selectedCoinId = null;
var selectedDays = 30;
var priceChart = null;
var hasLoadedOnce = false;
var chartRequestId = 0;

async function loadCoinList() {
  try {
    statusLine.textContent = "Loading market data...";

    var url = "https://api.coingecko.com/api/v3/coins/markets" +
      "?vs_currency=usd&order=market_cap_desc&per_page=60&page=1" +
      "&sparkline=false&price_change_percentage=24h";

    var response = await fetch(url);

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    allCoins = await response.json();

    renderCoinList();
    statusLine.textContent = "Updated just now  •  " + allCoins.length + " coins loaded";

    if (!hasLoadedOnce) {
      hasLoadedOnce = true;
      if (allCoins.length > 0) {
        var firstCoin = allCoins.find(function (c) { return c.id === "bitcoin"; }) || allCoins[0];
        selectCoin(firstCoin.id);
      }
    } else if (selectedCoinId) {
      var stillSelected = allCoins.find(function (c) { return c.id === selectedCoinId; });
      if (stillSelected) {
        updateDetailStats(stillSelected);
      }
    }

  } catch (err) {
    console.log(err);
    statusLine.textContent = "Could not load market data. Please refresh the page to try again.";
  }
}

function renderCoinList() {
  var searchTerm = searchInput.value.trim().toLowerCase();

  var coinsToShow = allCoins.filter(function (coin) {
    return coin.name.toLowerCase().includes(searchTerm) ||
           coin.symbol.toLowerCase().includes(searchTerm);
  });

  coinListEl.innerHTML = "";

  if (coinsToShow.length === 0) {
    var emptyMsg = document.createElement("p");
    emptyMsg.className = "empty-message";
    emptyMsg.textContent = "No coins match your search.";
    coinListEl.appendChild(emptyMsg);
    return;
  }

  coinsToShow.forEach(function (coin) {
    var row = document.createElement("div");
    row.className = "coin-row";
    if (coin.id === selectedCoinId) {
      row.classList.add("selected");
    }

    var changeValue = coin.price_change_percentage_24h;
    var changeClass = changeValue >= 0 ? "positive" : "negative";
    var changeText = (changeValue >= 0 ? "+" : "") + (changeValue ? changeValue.toFixed(2) : "0.00") + "%";

    row.innerHTML =
      '<img src="' + coin.image + '" alt="">' +
      '<div class="coin-row-info">' +
      '  <div class="coin-row-name">' + coin.name + '</div>' +
      '  <div class="coin-row-symbol">' + coin.symbol + '</div>' +
      '</div>' +
      '<div class="coin-row-right">' +
      '  <div class="coin-row-price">' + formatPrice(coin.current_price) + '</div>' +
      '  <div class="' + changeClass + '">' + changeText + '</div>' +
      '</div>';

    row.addEventListener("click", function () {
      selectCoin(coin.id);
    });

    coinListEl.appendChild(row);
  });
}

function selectCoin(coinId) {
  selectedCoinId = coinId;

  var coin = allCoins.find(function (c) { return c.id === coinId; });
  if (!coin) return;

  updateDetailStats(coin);

  renderCoinList();

  loadChartData(coinId, selectedDays);
}

function updateDetailStats(coin) {
  detailIcon.src = coin.image;
  detailIcon.alt = coin.name;
  detailName.textContent = coin.name;
  detailSymbol.textContent = coin.symbol.toUpperCase();
  detailPrice.textContent = formatPrice(coin.current_price);

  var changeValue = coin.price_change_percentage_24h || 0;
  detailChange.textContent = (changeValue >= 0 ? "+" : "") + changeValue.toFixed(2) + "% (24h)";
  detailChange.className = "detail-change " + (changeValue >= 0 ? "positive" : "negative");

  statMarketCap.textContent = formatBigNumber(coin.market_cap);
  statVolume.textContent = formatBigNumber(coin.total_volume);
  statHigh.textContent = formatPrice(coin.high_24h);
  statLow.textContent = formatPrice(coin.low_24h);
}

async function loadChartData(coinId, days) {
  chartRequestId = chartRequestId + 1;
  var thisRequestId = chartRequestId;

  try {
    var url = "https://api.coingecko.com/api/v3/coins/" + coinId +
      "/market_chart?vs_currency=usd&days=" + days;

    var response = await fetch(url);

    if (response.status === 429) {
      throw new Error("rate-limited");
    }
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    var data = await response.json();

    if (thisRequestId !== chartRequestId) {
      return;
    }

    var labels = data.prices.map(function (point) {
      var date = new Date(point[0]);
      if (days === "1" || days === 1) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    });

    var prices = data.prices.map(function (point) { return point[1]; });

    drawChart(labels, prices);

  } catch (err) {
    if (thisRequestId === chartRequestId) {
      console.log(err);
      if (err.message === "rate-limited") {
        statusLine.textContent = "CoinGecko's free API limits how many requests we can make per minute. Wait a few seconds and click the range again.";
      } else {
        statusLine.textContent = "Could not load the chart for this coin.";
      }
    }
  }
}

function drawChart(labels, prices) {
  var canvas = document.getElementById("priceChart");

  var wentUp = prices[prices.length - 1] >= prices[0];
  var lineColor = wentUp ? "#2ecc71" : "#e74c3c";

  if (priceChart) {
    priceChart.destroy();
  }

  priceChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Price (USD)",
        data: prices,
        borderColor: lineColor,
        backgroundColor: lineColor + "22",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8, color: "#8b949e" },
          grid: { display: false }
        },
        y: {
          ticks: {
            color: "#8b949e",
            callback: function (value) { return formatPrice(value); }
          },
          grid: { color: "#30363d" }
        }
      }
    }
  });
}

function formatPrice(value) {
  if (value === undefined || value === null) return "--";

  var decimals = value < 1 ? 6 : 2;

  return "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals
  });
}

function formatBigNumber(value) {
  if (value === undefined || value === null) return "--";

  if (value >= 1e12) return "$" + (value / 1e12).toFixed(2) + "T";
  if (value >= 1e9) return "$" + (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return "$" + (value / 1e6).toFixed(2) + "M";
  return "$" + value.toLocaleString("en-US");
}

searchInput.addEventListener("input", renderCoinList);

rangeButtons.addEventListener("click", function (event) {
  var clicked = event.target.closest(".range-btn");
  if (!clicked) return;

  var allButtons = rangeButtons.querySelectorAll(".range-btn");
  allButtons.forEach(function (btn) { btn.classList.remove("active"); });
  clicked.classList.add("active");

  var days = clicked.getAttribute("data-days");
  selectedDays = Number(days);

  loadChartData(selectedCoinId, selectedDays);
});

themeToggleBtn.addEventListener("click", function () {
  var html = document.documentElement;
  var isLight = html.getAttribute("data-theme") === "light";

  if (isLight) {
    html.setAttribute("data-theme", "dark");
    themeToggleBtn.textContent = "🌙 Dark";
  } else {
    html.setAttribute("data-theme", "light");
    themeToggleBtn.textContent = "☀️ Light";
  }

  if (selectedCoinId) {
    loadChartData(selectedCoinId, selectedDays);
  }
});

loadCoinList();
setInterval(loadCoinList, 60000);