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
    // Check for saved theme preference or use system preference
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

    // Generate hourly intervals (00:00 to 23:00)
    for (let hour = 0; hour < 24; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      const option = document.createElement('option');
      option.value = timeString;
      option.textContent = timeString;
      timeSelect.appendChild(option);
    }

    // Set default to current hour
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    timeSelect.value = `${currentHour}:00`;
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

    // Determine API endpoint based on date
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

    // Select levels >= minHpa (note: higher hPa = lower altitude)
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

    // Calculate the target hour index
    const [hh, mm] = time.split(':').map(Number);
    const targetHour = Math.round(hh + mm / 60);
    const index = targetHour % 24;

    // Extract data
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
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isDark = document.body.classList.contains('dark-mode');

    const axisColor = isDark ? '#e5e7eb' : '#000000';
    const textColor = isDark ? '#e5e7eb' : '#000000';
    const lineColor = isDark ? '#60a5fa' : '#0000ff';
    const pointColor = isDark ? '#60a5fa' : '#0000ff';
    const arrowColor = isDark ? '#f87171' : '#ff0000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    // Set up dimensions and scaling
    const padding = 60; // Increased padding for labels
    const width = canvas.width - 2 * padding;
    const height = canvas.height - 2 * padding;
    const maxSpeed = Math.max(...windData.map(d => d.speed), 20); // Minimum 20 for scale
    const maxAlt = Math.max(...windData.map(d => d.altitude));

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const numTicks = 5;
    for (let i = 1; i < numTicks; i++) {
      // Vertical grid
      const x = padding + (i / numTicks) * width;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height + padding);
      ctx.stroke();

      // Horizontal grid
      const y = height + padding - (i / numTicks) * height; // From bottom up
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width + padding, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height + padding);
    ctx.lineTo(width + padding, height + padding);
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Set font
    ctx.font = '12px Arial';
    ctx.fillStyle = textColor;

    // Draw x-axis label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Wind Speed (${unitMap[speedUnit]})`, padding + width / 2, height + padding + 20);

    // Draw y-axis label
    ctx.save();
    ctx.translate(20, padding + height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Altitude (m)', 0, 0);
    ctx.restore();

    // Draw tick marks and labels
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i <= numTicks; i++) {
      // X ticks
      const x = padding + (i / numTicks) * width;
      const yBottom = height + padding;
      ctx.beginPath();
      ctx.moveTo(x, yBottom);
      ctx.lineTo(x, yBottom + 5);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(((i / numTicks) * maxSpeed).toFixed(0), x, yBottom + 10);

      // Y ticks
      const yTick = height + padding - (i / numTicks) * height;
      ctx.beginPath();
      ctx.moveTo(padding, yTick);
      ctx.lineTo(padding - 5, yTick);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(((i / numTicks) * maxAlt).toFixed(0), padding - 10, yTick);
    }

    // Draw wind speed line
    ctx.beginPath();
    windData.forEach((d, i) => {
      const x = padding + (d.speed / maxSpeed) * width;
      const y = height + padding - (d.altitude / maxAlt) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw data points and direction arrows
    windData.forEach((d, i) => {
      const x = padding + (d.speed / maxSpeed) * width;
      const y = height + padding - (d.altitude / maxAlt) * height;

      // Point
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = pointColor;
      ctx.fill();
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arrow for direction
      const arrowLength = 20;
      const angle = ((360 - d.direction) * Math.PI) / 180; // Adjust: 0° north, clockwise
      const arrowX = x + Math.cos(angle) * arrowLength;
      const arrowY = y - Math.sin(angle) * arrowLength;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(arrowX, arrowY);
      ctx.strokeStyle = arrowColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrowhead
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
    text.innerText = '🌬️ Fetch Wind Data';
  }

  private showError(message: string): void {
    this.errorMessage.innerText = message;
    this.errorMessage.style.display = 'flex';
    this.results.style.display = 'none';
  }
}

new WindDataFetcher();