let data = [];
let map;
let geojsonLayer;

// ====== MEMUAT DATA ======
fetch("data_kemiskinan_jabar_2010_2024.json")
  .then((response) => response.json())
  .then((json) => {
    data = json;
    initApp();

    const tahunPertama = [...new Set(data.map((d) => d.tahun))].sort((a, b) => a - b)[0];
    updateInsight(tahunPertama);
  })
  .catch((error) => console.error("Gagal memuat data:", error));

// ====== INISIALISASI ======
function initApp() {
  const tahunSelect = document.getElementById("tahun");
  const kabSelect = document.getElementById("kabupaten");

  const tahunUnik = [...new Set(data.map((d) => d.tahun))].sort((a, b) => a - b);
  const kabUnik = [...new Set(data.map((d) => d.kabupaten))].sort();

  tahunUnik.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tahunSelect.appendChild(opt);
  });

  kabUnik.forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k;
    kabSelect.appendChild(opt);
  });

  tahunSelect.value = tahunUnik[0];
  kabSelect.value = "all";

  tahunSelect.addEventListener("change", updateVisual);
  kabSelect.addEventListener("change", updateVisual);
  document.getElementById("visual").addEventListener("change", updateVisual);

  buatPeta(tahunUnik[0]);
  buatGrafik(tahunUnik[0], "all");
  buatLineChart();
  buatStatistik(tahunUnik[0], "all");
}

// ====== WARNA ======
function getColor(persen) {
  return persen > 12
    ? "#800026"
    : persen > 10
    ? "#BD0026"
    : persen > 8
    ? "#E31A1C"
    : persen > 6
    ? "#FC4E2A"
    : persen > 4
    ? "#FD8D3C"
    : persen > 2
    ? "#FEB24C"
    : "#FFEDA0";
}

// ====== GAYA PETA ======
function style(feature, tahun, kabupatenDipilih) {
  const namaWilayah = feature.properties.VARNAME_2;
  const dataKab = data.find(
    (d) =>
      d.kabupaten.toLowerCase() === namaWilayah.toLowerCase() &&
      d.tahun === tahun
  );
  const persen = dataKab ? dataKab.persentase_miskin : null;
  let highlight =
    kabupatenDipilih !== "all" &&
    namaWilayah.toLowerCase() === kabupatenDipilih.toLowerCase();

  return {
    fillColor: persen ? getColor(persen) : "#d3d3d3",
    weight: highlight ? 3 : 1,
    opacity: 1,
    color: highlight ? "#333" : "white",
    fillOpacity: highlight ? 1 : 0.8,
  };
}

// ====== TOOLTIP PETA ======
function onEachFeature(feature, layer, tahun) {
  const namaWilayah = feature.properties.VARNAME_2;
  const dataKab = data.find(
    (d) =>
      d.kabupaten.toLowerCase() === namaWilayah.toLowerCase() &&
      d.tahun === tahun
  );
  if (dataKab) {
    layer.bindTooltip(
      `<strong>${namaWilayah}</strong><br>Persentase miskin: ${dataKab.persentase_miskin}%`,
      { direction: "center", className: "tooltip" }
    );
  } else {
    layer.bindTooltip(
      `<strong>${namaWilayah}</strong><br><i>Data tidak tersedia</i>`,
      { direction: "center", className: "tooltip" }
    );
  }
}

// ====== MEMBUAT PETA ======
function buatPeta(tahun, kabupaten = "all") {
  if (!map) {
    map = L.map("map").setView([-7.0, 107.6], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
  }

  fetch("jawa_barat.geojson")
    .then((res) => res.json())
    .then((geojsonData) => {
      if (geojsonLayer) map.removeLayer(geojsonLayer);
      geojsonLayer = L.geoJSON(geojsonData, {
        style: (feature) => style(feature, tahun, kabupaten),
        onEachFeature: (feature, layer) => onEachFeature(feature, layer, tahun),
      }).addTo(map);
    });

  // ===== LEGENDA =====
  if (map && !map._legendAdded) {
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "legend");
      const grades = [0, 2, 4, 6, 8, 10, 12];
      div.innerHTML += "<h4>Tingkat Kemiskinan (%)</h4>";
      for (let i = 0; i < grades.length; i++) {
        div.innerHTML +=
          `<i style="background:${getColor(grades[i] + 1)}"></i> ${grades[i]}${grades[i + 1] ? "&ndash;" + grades[i + 1] + "<br>" : "+"}`;
      }
      return div;
    };
    legend.addTo(map);
    map._legendAdded = true;
  }
}

// ====== UPDATE SAAT FILTER BERUBAH ======
function updateVisual() {
  const tahunDipilih = parseInt(document.getElementById("tahun").value);
  const kabupatenDipilih = document.getElementById("kabupaten").value;

  buatPeta(tahunDipilih, kabupatenDipilih);
  buatGrafik(tahunDipilih, kabupatenDipilih);
  buatStatistik(tahunDipilih, kabupatenDipilih);
  updateInsight(tahunDipilih);
}

// ====== GRAFIK DINAMIS (BAR & PIE) ======
function buatGrafik(tahun, kabupaten) {
  const ctx = document.getElementById("chart").getContext("2d");
  const visualType = document.getElementById("visual").value || "bar";
  if (window.chartInstance) window.chartInstance.destroy();

  let perTahun = data.filter((d) => d.tahun === tahun);
  if (kabupaten !== "all") perTahun = perTahun.filter((d) => d.kabupaten === kabupaten);

  const labels = perTahun.map((d) => d.kabupaten);
  const values = perTahun.map((d) => d.persentase_miskin);

  const options = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio:
    visualType === "pie"
      ? 1 
      : window.innerWidth < 768
      ? 1.1 
      : 1.7, 

  plugins: {
    legend: {
      display: visualType === "pie",
      position: "bottom",
      labels: { boxWidth: 15, font: { size: 11 } },
    },
    tooltip: { enabled: true },
  },

  scales:
    visualType === "pie"
      ? {}
      : {
          x: {
            ticks: {
              autoSkip: true,
              maxTicksLimit: window.innerWidth < 768 ? 5 : 15,
              maxRotation: 70,
              minRotation: 30,
              font: { size: window.innerWidth < 768 ? 9 : 11 },
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: window.innerWidth < 768 ? 10 : 12 },
            },
          },
        },

  interaction: { mode: "nearest", intersect: false },
  animation: { duration: 1000, easing: "easeOutQuart" },
};

  window.chartInstance = new Chart(ctx, {
    type: visualType,
    data: {
      labels,
      datasets: [
        {
          label: `Tingkat Kemiskinan (${tahun})`,
          data: values,
          backgroundColor: values.map((v) => getColor(v)),
          borderColor: "#fff",
          borderWidth: 1,
        },
      ],
    },
    options,
  });

  const rata2 = (
    perTahun.reduce((sum, d) => sum + d.persentase_miskin, 0) / perTahun.length
  ).toFixed(2);
  const tertinggi = perTahun.reduce((a, b) =>
    a.persentase_miskin > b.persentase_miskin ? a : b
  );
  const terendah = perTahun.reduce((a, b) =>
    a.persentase_miskin < b.persentase_miskin ? a : b
  );

  const chartInsightText = `Pada tahun <b>${tahun}</b>, rata-rata tingkat kemiskinan adalah <b>${rata2}%</b>.
  Kabupaten/kota dengan tingkat kemiskinan tertinggi adalah <b>${tertinggi.kabupaten}</b> (${tertinggi.persentase_miskin}%),
  sedangkan terendah adalah <b>${terendah.kabupaten}</b> (${terendah.persentase_miskin}%).`;

  const chartInsight = document.getElementById("chart-insight");
  if (chartInsight) {
    chartInsight.innerHTML = chartInsightText;
    chartInsight.classList.remove("show");
    setTimeout(() => chartInsight.classList.add("show"), 50);
  }
}

// ====== GRAFIK GARIS ======
function buatLineChart() {
  const ctx = document.getElementById("lineChart").getContext("2d");
  if (window.lineChartInstance) window.lineChartInstance.destroy();

  const rataPerTahun = [...new Set(data.map((d) => d.tahun))].map((t) => {
    const perTahun = data.filter((d) => d.tahun === t);
    const rata =
      perTahun.reduce((sum, d) => sum + d.persentase_miskin, 0) / perTahun.length;
    return { tahun: t, rata };
  });

  window.lineChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: rataPerTahun.map((d) => d.tahun),
      datasets: [
        {
          label: "Rata-rata Kemiskinan Jawa Barat",
          data: rataPerTahun.map((d) => d.rata),
          borderColor: "#2b7a78",
          backgroundColor: "rgba(59, 170, 156, 0.2)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: window.innerWidth < 768 ? 1.1 : 1.8, 
      scales: {
        y: { beginAtZero: true },
        x: {
          ticks: {
            font: { size: window.innerWidth < 768 ? 9 : 11 },
          },
        },
      },
      animation: { duration: 1000, easing: "easeOutCubic" },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { font: { size: 11 } },
        },
      },
    },
  });
}

// ====== STATISTIK ======
function buatStatistik(tahun, kabupaten) {
  let dataTahun = data.filter((d) => d.tahun === tahun);
  if (kabupaten !== "all") dataTahun = dataTahun.filter((d) => d.kabupaten === kabupaten);

  const rata =
    dataTahun.reduce((sum, d) => sum + d.persentase_miskin, 0) / dataTahun.length;
  const tertinggi = Math.max(...dataTahun.map((d) => d.persentase_miskin));
  const terendah = Math.min(...dataTahun.map((d) => d.persentase_miskin));

  document.getElementById("avg").textContent = rata.toFixed(2) + "%";
  document.getElementById("high").textContent = tertinggi.toFixed(2) + "%";
  document.getElementById("low").textContent = terendah.toFixed(2) + "%";
}

// ====== INSIGHT UMUM (untuk peta & tren) ======
function updateInsight(tahun) {
  const dataTahun = data.filter((d) => d.tahun === tahun);
  if (dataTahun.length === 0) return;

  const rata2 = (
    dataTahun.reduce((sum, d) => sum + d.persentase_miskin, 0) / dataTahun.length
  ).toFixed(2);

  const tertinggi = dataTahun.reduce((a, b) =>
    a.persentase_miskin > b.persentase_miskin ? a : b
  );
  const terendah = dataTahun.reduce((a, b) =>
    a.persentase_miskin < b.persentase_miskin ? a : b
  );

  const insight = `Tahun <b>${tahun}</b> menunjukkan rata-rata tingkat kemiskinan sebesar <b>${rata2}%</b>. 
  Kabupaten/kota dengan tingkat kemiskinan tertinggi adalah <b>${tertinggi.kabupaten}</b> (${tertinggi.persentase_miskin}%), 
  sedangkan yang terendah adalah <b>${terendah.kabupaten}</b> (${terendah.persentase_miskin}%).`;

  const mapInsight = document.getElementById("map-insight");
  const chartInsight = document.getElementById("insight-text");
  if (mapInsight) mapInsight.innerHTML = insight;
  if (chartInsight) chartInsight.innerHTML = insight;

  document.querySelectorAll(".insight").forEach(el => {
    el.classList.remove("show");
    setTimeout(() => el.classList.add("show"), 50);
  });
}
