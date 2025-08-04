// Mock Chart.js for testing

export const mockChart = {
  data: {},
  options: {},
  update: vi.fn(),
  destroy: vi.fn(),
  resize: vi.fn(),
  clear: vi.fn(),
  render: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  getElementsAtEventForMode: vi.fn().mockReturnValue([]),
  getSortedVisibleDatasetMetas: vi.fn().mockReturnValue([]),
  getDatasetMeta: vi.fn().mockReturnValue({
    data: [],
    dataset: {},
    hidden: false,
    visible: true,
  }),
  canvas: {
    style: {},
    getContext: vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    }),
  },
  ctx: {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
  },
}

// Mock Chart constructor
export const MockChart = vi.fn().mockImplementation(() => mockChart)

// Mock Chart.js modules
export const mockChartJS = {
  Chart: MockChart,
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
  register: vi.fn(),
}

// Mock react-chartjs-2
export const mockReactChartJS2 = {
  Line: vi.fn(props => {
    // Store props for testing verification
    mockReactChartJS2.Line.lastProps = props
    return null // Return null since we're not actually rendering
  }),
  Bar: vi.fn(props => {
    mockReactChartJS2.Bar.lastProps = props
    return null
  }),
  getElementAtEvent: vi.fn().mockReturnValue([]),
  getElementsAtEvent: vi.fn().mockReturnValue([]),
  getDatasetAtEvent: vi.fn().mockReturnValue([]),
}

// Setup function to mock Chart.js in tests
export const setupChartJSMocks = () => {
  // Mock chart.js
  vi.mock('chart.js', () => mockChartJS)

  // Mock react-chartjs-2
  vi.mock('react-chartjs-2', () => mockReactChartJS2)

  // Mock chartjs-plugin-streaming if used
  vi.mock('chartjs-plugin-streaming', () => ({
    StreamingPlugin: {},
    RealTimeScale: {},
  }))

  return {
    mockChart,
    MockChart,
    mockChartJS,
    mockReactChartJS2,
  }
}

export default mockChart
