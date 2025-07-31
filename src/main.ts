import { Chart } from 'chart.js/auto';

interface WeatherResponse {
  hourly: {
    time: string[];
    [key: string]: number[] | string[];
  };
}

interface WindData {
  altitude: number;
  speed: number;
  direction: number;
  cardinalDirection: string;
}

interface FormData {
  latitude: number;
  longitude: number;
  date: string;
  time: string;
  speedUnit: string;
  minHpa: number;
}

interface Level {
  hpa: number;
  alt: number;
}

const levels: Level[] = [
  { hpa: 1013, alt: 10 },
  { hpa: 1004, alt: 80 },
  { hpa: 1000, alt: 110 },
  { hpa: 975, alt: 320 },
  { hpa: 950, alt: 500 },
  { hpa: 925, alt: 800 },
  { hpa: 900, alt: 1000 },
  { hpa: 875, alt: 1200 },
  { hpa: 850, alt: 1500 },
  { hpa: 825, alt: 1700 },
  { hpa: 800, alt: 1900 },
  { hpa: 775, alt: 2200 },
  { hpa: 750, alt: 2500 },
  { hpa: 725, alt: 2700 },
  { hpa: 700, alt: 3000 },
  { hpa: 675, alt: 3300 },
  { hpa: 650, alt: 3600 },
  { hpa: 625, alt: 3900 },
  { hpa: 600, alt: 4200 },
  { hpa: 575, alt: 4500 },
  { hpa: 550, alt: 4900 },
  { hpa: 525, alt: 5100 },
  { hpa: 500, alt: 5600 },
  { hpa: 475, alt: 6000 },
  { hpa: 450, alt: 6300 },
  { hpa: 425, alt: 6800 },
  { hpa: 400, alt: 7200 },
  { hpa: 375, alt: 7600 },
  { hpa: 350, alt: 8100 },
  { hpa: 325, alt: 8600 },
  { hpa: 300, alt: 9200 },
  { hpa: 275, alt: 9700 },
  { hpa: 250, alt: 10400 },
  { hpa: 225, alt: 11000 },
  { hpa: 200, alt: 11800 },
  { hpa: 175, alt: 12600 },
  { hpa: 150, alt: 13500 },
  { hpa: 125, alt: 14600 },
  { hpa: 100, alt: 15800 },
  { hpa: 70, alt: 17700 },
  { hpa: 50, alt: 19300 },
  { hpa: 40, alt: 20000 },
  { hpa: 30, alt: 22000 },
  { hpa: 20, alt: 23000 },
  { hpa: 15, alt: 24000 },
  { hpa: 10, alt: 26000 },
];

const unitMap: { [key: string]: string } = {
  kmh: 'km/h',
  ms: 'm/s',
  mph: 'mph',
  kn: 'kn',
};

function getCardinal(direction: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(direction / 22.5) % 16;
  return dirs[index];
}

class WindDataFetcher {
  private form: HTMLFormElement;
  private fetchButton: HTMLButtonElement;
  private errorMessage: HTMLDivElement;
  private loadingIndicator: HTMLDivElement;
  private results: HTMLDivElement;
  private currentWindData: WindData[] = [];
  private currentFormData: FormData | null = null;
  private themeSwitch: HTMLInputElement;
  private chart: Chart | null = null;

  constructor() {
    this.form = document.getElementById('windForm') as HTMLFormElement;
    this.fetchButton = document.getElementById('fetchButton') as HTMLButtonElement;
    this.errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
    this.loadingIndicator = document.getElementById('loadingIndicator') as HTMLDivElement;
    this.results = document.getElementById('results') as HTMLDivElement;
    this.themeSwitch = document.getElementById('themeSwitch') as HTMLInputElement;

    this.init();
  }

  private init(): void {
    this.setupTimeOptions();
    this.setupEventListeners();
    this.setDefaultDate();
    this.setupTheme();
  }

  private setupTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.body.classList.add('dark-mode');
      this.themeSwitch.checked = true;
    }

    this.themeSwitch.addEventListener('change', () => {
      document.body.classList.toggle('dark-mode', this.themeSwitch.checked);
      localStorage.setItem('theme', this.themeSwitch.checked ? 'dark' : 'light');
      if (this.results.style.display === 'block') {
        this.drawGraph();
      }
    });
  }

  private setupTimeOptions(): void {
    const timeSelect = document.getElementById('time') as HTMLSelectElement;
    for (let hour = 0; hour < 24; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      const option = document.createElement('option');
      option.value = timeString;
      option.textContent = timeString;
      timeSelect.appendChild(option);
    }
    const now = new Date();
    timeSelect.value = `${now.getHours().toString().padStart(2, '0')}:00`;
  }

  private setDefaultDate(): void {
    const dateInput = document.getElementById('date') as HTMLInputElement;
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
  }

  private setupEventListeners(): void {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    document.getElementById('downloadCsv')?.addEventListener('click', this.downloadCsv.bind(this));
    document.getElementById('copyData')?.addEventListener('click', this.copyToClipboard.bind(this));
  }

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.style.display = 'none';
    try {
      const formData = this.getFormData();
      this.validateFormData(formData);
      this.showLoading();
      const windData = await this.fetchWindData(formData);
      this.displayResults(windData, formData);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      this.hideLoading();
    }
  }

  private getFormData(): FormData {
    return {
      latitude: parseFloat((document.getElementById('latitude') as HTMLInputElement).value),
      longitude: parseFloat((document.getElementById('longitude') as HTMLInputElement).value),
      date: (document.getElementById('date') as HTMLInputElement).value,
      time: (document.getElementById('time') as HTMLSelectElement).value,
      speedUnit: (document.getElementById('speedUnit') as HTMLSelectElement).value,
      minHpa: parseInt((document.getElementById('minHpa') as HTMLSelectElement).value)
    };
  }

  private validateFormData(data: FormData): void {
    if (isNaN(data.latitude) || data.latitude < -90 || data.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90 degrees');
    }
    if (isNaN(data.longitude) || data.longitude < -180 || data.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180 degrees');
    }
    if (!data.date) {
      throw new Error('Please select a date');
    }
    if (!data.time) {
      throw new Error('Please select a time');
    }
  }

  private async fetchWindData(formData: FormData): Promise<WindData[]> {
    const { latitude, longitude, date, time, speedUnit, minHpa } = formData;
    const currentDate = new Date();
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(currentDate.getDate() - 7);
    let baseUrl = 'https://api.open-meteo.com/v1/forecast';
    if (new Date(date) < sevenDaysAgo) {
      baseUrl = 'https://archive-api.open-meteo.com/v1/archive';
    }
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      start_date: date,
      end_date: date,
      timezone: 'auto',
      wind_speed_unit: speedUnit
    });
    const selectedLevels = levels.filter(l => l.hpa >= minHpa).sort((a, b) => a.alt - b.alt);
    const windParams: string[] = [];
    selectedLevels.forEach(l => {
      const suffix = l.hpa === 1013 ? '_10m' : l.hpa === 1004 ? '_80m' : `_${l.hpa}hPa`;
      windParams.push(`wind_speed${suffix}`);
      windParams.push(`wind_direction${suffix}`);
    });
    params.append('hourly', windParams.join(','));
    const url = `${baseUrl}?${params.toString()}`;
    console.log('Fetching from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data = await response.json() as WeatherResponse;
    const hourly = data.hourly;
    const [hh, mm] = time.split(':').map(Number);
    const targetHour = Math.round(hh + mm / 60);
    const index = targetHour % 24;
    const windData: WindData[] = [];
    selectedLevels.forEach(l => {
      const suffix = l.hpa === 1013 ? '_10m' : l.hpa === 1004 ? '_80m' : `_${l.hpa}hPa`;
      const speed = hourly[`wind_speed${suffix}`]?.[index] ?? 0;
      const direction = hourly[`wind_direction${suffix}`]?.[index] ?? 0;
      const cardinal = getCardinal(direction);
      windData.push({
        altitude: l.alt,
        speed,
        direction,
        cardinalDirection: cardinal
      });
    });
    return windData;
  }

  private displayResults(windData: WindData[], formData: FormData): void {
    this.currentWindData = windData;
    this.currentFormData = formData;
    const { latitude, longitude, date, time, speedUnit } = formData;
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lonDir = longitude >= 0 ? 'E' : 'W';
    (document.getElementById('locationInfo') as HTMLSpanElement).innerText = `Location: ${Math.abs(latitude).toFixed(4)}° ${latDir}, ${Math.abs(longitude).toFixed(4)}° ${lonDir}`;
    (document.getElementById('dateTimeInfo') as HTMLSpanElement).innerText = `Date/Time: ${date} ${time} (local time at location)`;
    const tbody = this.results.querySelector('tbody') as HTMLTableSectionElement;
    tbody.innerHTML = '';
    windData.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.altitude} m</td>
        <td>${d.speed.toFixed(1)} ${unitMap[speedUnit]}</td>
        <td>${d.direction.toFixed(0)}°</td>
        <td>${d.cardinalDirection}</td>
      `;
      tbody.appendChild(tr);
    });
    this.drawGraph();
    this.results.style.display = 'block';
  }

  private drawGraph(): void {
    if (!this.currentFormData || !this.currentWindData.length) return;
    const { speedUnit } = this.currentFormData;
    const windData = this.currentWindData;
    const canvas = document.getElementById('windVectorCanvas') as HTMLCanvasElement;
    const isDark = document.body.classList.contains('dark-mode');

    // Define theme-aware colors
    const colors = {
      grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      axis: isDark ? '#e5e7eb' : '#000000',
      line: isDark ? '#60a5fa' : '#0000ff',
      point: isDark ? '#60a5fa' : '#0000ff',
      arrow: isDark ? '#f87171' : '#ff0000',
      text: isDark ? '#e5e7eb' : '#000000',
      background: isDark ? '#374151' : '#f9fafb'
    };

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    // Custom plugin to draw wind direction arrows
    const arrowPlugin = {
      id: 'windDirectionArrows',
      afterDatasetsDraw(chart: Chart) {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);

        meta.data.forEach((element: any, index: number) => {
          const data = windData[index];
          const x = element.x;
          const y = element.y;
          const angle = ((360 - data.direction) * Math.PI) / 180; // Adjust: 0° north, clockwise
          const arrowLength = 20;
          const arrowX = x + Math.cos(angle) * arrowLength;
          const arrowY = y - Math.sin(angle) * arrowLength;

          // Draw arrow line
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(arrowX, arrowY);
          ctx.strokeStyle = colors.arrow;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Draw arrowhead
          const headLength = 6;
          const headAngle = Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - headLength * Math.cos(angle - headAngle),
            arrowY + headLength * Math.sin(angle - headAngle)
          );
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - headLength * Math.cos(angle + headAngle),
            arrowY + headLength * Math.sin(angle + headAngle)
          );
          ctx.stroke();
        });
      }
    };

    // Register the plugin
    Chart.register(arrowPlugin);

    // Determine max wind speed for x-axis scaling
    const maxSpeed = Math.max(...windData.map(d => d.speed), 20); // Minimum 20 for scale

    // Create new chart
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Wind Speed',
          data: windData.map(d => ({ x: d.speed, y: d.altitude })),
          borderColor: colors.line,
          backgroundColor: colors.point,
          pointRadius: 4,
          pointHoverRadius: 6,
          showLine: true,
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Allow the chart to fill the container height
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = windData[context.dataIndex];
                return `Speed: ${data.speed.toFixed(1)} ${unitMap[speedUnit]}, Altitude: ${data.altitude} m, Direction: ${data.direction}° (${data.cardinalDirection})`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: `Wind Speed (${unitMap[speedUnit]})`,
              color: colors.text,
              font: { size: 14 }
            },
            grid: {
              color: colors.grid
            },
            ticks: {
              color: colors.text
            },
            min: 0,
            max: maxSpeed * 1.2 // Add 20% padding
          },
          y: {
            type: 'linear',
            title: {
              display: true,
              text: 'Altitude (m)',
              color: colors.text,
              font: { size: 14 }
            },
            grid: {
              color: colors.grid
            },
            ticks: {
              color: colors.text
            },
            beginAtZero: false,
            min: 0,
            max: Math.max(...windData.map(d => d.altitude)) * 1.2 // Add 20% padding
          }
        }
      }
    });
  }

  private downloadCsv(): void {
    if (!this.currentWindData) return;
    const headers = 'altitude,speed,direction\n';
    const rows = this.currentWindData.map(d => `${d.altitude},${d.speed},${d.direction}`).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wind_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private copyToClipboard(): void {
    if (!this.currentWindData) return;
    const headers = 'altitude,speed,direction\n';
    const rows = this.currentWindData.map(d => `${d.altitude},${d.speed},${d.direction}`).join('\n');
    const csv = headers + rows;
    navigator.clipboard.writeText(csv).then(() => {
      alert('Data copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  private showLoading(): void {
    this.loadingIndicator.style.display = 'block';
    this.results.style.display = 'none';
    this.fetchButton.disabled = true;
    const spinner = this.fetchButton.querySelector('.spinner') as HTMLDivElement;
    const text = this.fetchButton.querySelector('.button-text') as HTMLSpanElement;
    spinner.style.display = 'inline-block';
    text.innerText = 'Fetching...';
  }

  private hideLoading(): void {
    this.loadingIndicator.style.display = 'none';
    this.fetchButton.disabled = false;
    const spinner = this.fetchButton.querySelector('.spinner') as HTMLDivElement;
    const text = this.fetchButton.querySelector('.button-text') as HTMLSpanElement;
    spinner.style.display = 'none';
    text.innerText = 'Get Winds';
  }

  private showError(message: string): void {
    this.errorMessage.innerText = message;
    this.errorMessage.style.display = 'flex';
    this.results.style.display = 'none';
  }
}

new WindDataFetcher();