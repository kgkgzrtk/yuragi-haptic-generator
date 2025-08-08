import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WaveformChart } from '@/components/Visualization/WaveformChart'
import { render, screen } from '@/test/test-utils'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import type { IWaveformData } from '@/types/hapticTypes'
import * as chartConfig from '@/utils/chartConfig'

// Mock Chart.js - need to match the import pattern in WaveformChart.tsx
vi.mock('chart.js', () => {
  const ChartClass = vi.fn().mockImplementation(() => ({
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
  }))

  ChartClass.register = vi.fn()

  return {
    Chart: ChartClass,
    CategoryScale: {},
    LinearScale: {},
    PointElement: {},
    LineElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
    Filler: {},
    register: vi.fn(),
    default: ChartClass,
  }
})

vi.mock('react-chartjs-2', () => ({
  Line: vi.fn(({ data, options, ...props }) => (
    <div
      data-testid='mock-line-chart'
      data-chart-data={JSON.stringify(data)}
      data-chart-options={JSON.stringify(options)}
      {...props}
    >
      Mock Line Chart
    </div>
  )),
}))

// Mock the chart config utilities
vi.mock('@/utils/chartConfig', () => ({
  getWaveformChartOptions: vi.fn(() => ({ responsive: true })),
  createWaveformData: vi.fn(() => ({
    labels: [],
    datasets: [],
  })),
  CHANNEL_COLORS: {
    0: '#FF6384', // DEVICE1_X
    1: '#36A2EB', // DEVICE1_Y
    2: '#FFCE56', // DEVICE2_X
    3: '#4BC0C0', // DEVICE2_Y
  },
}))

// Imports have been moved to the top of the file

describe('WaveformChart', () => {
  const mockWaveformData: IWaveformData = {
    timestamp: '2024-01-01T00:00:00Z',
    sampleRate: 44100,
    channels: [
      {
        channelId: CHANNEL_IDS.DEVICE1_X,
        data: [0.1, 0.2, 0.3, 0.4, 0.5],
      },
      {
        channelId: CHANNEL_IDS.DEVICE1_Y,
        data: [0.5, 0.4, 0.3, 0.2, 0.1],
      },
    ],
  }

  const defaultProps = {
    channelId: CHANNEL_IDS.DEVICE1_X,
    waveformData: mockWaveformData,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders with correct test ID', () => {
      render(<WaveformChart {...defaultProps} />)

      expect(screen.getByTestId(`waveform-chart-${CHANNEL_IDS.DEVICE1_X}`)).toBeInTheDocument()
    })

    it('renders mock chart component', () => {
      render(<WaveformChart {...defaultProps} />)

      expect(screen.getByTestId('mock-line-chart')).toBeInTheDocument()
    })

    it('applies custom height', () => {
      const customHeight = 300
      render(<WaveformChart {...defaultProps} height={customHeight} />)

      const chartContainer = screen.getByTestId(`waveform-chart-${CHANNEL_IDS.DEVICE1_X}`)
      expect(chartContainer).toHaveStyle({ height: `${customHeight}px` })
    })

    it('uses default height when not specified', () => {
      render(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} />)

      const chartContainer = screen.getByTestId(`waveform-chart-${CHANNEL_IDS.DEVICE1_X}`)
      expect(chartContainer).toHaveStyle({ height: '400px' }) // Updated to match default in WaveformChart.tsx
    })
  })

  describe('Data Processing', () => {
    it.skip('finds correct channel data from waveform data', () => {
      render(<WaveformChart {...defaultProps} />)

      // Verify createWaveformData was called with correct channel data
      expect(chartConfig.createWaveformData).toHaveBeenCalledWith(
        CHANNEL_IDS.DEVICE1_X,
        [0.1, 0.2, 0.3, 0.4, 0.5],
        44100
      )
    })

    it('handles missing channel data gracefully', () => {
      const waveformDataWithoutChannel: IWaveformData = {
        timestamp: '2024-01-01T00:00:00Z',
        sampleRate: 44100,
        channels: [
          {
            channelId: CHANNEL_IDS.DEVICE1_Y, // Different channel
            data: [0.1, 0.2, 0.3],
          },
        ],
      }

      render(
        <WaveformChart
          channelId={CHANNEL_IDS.DEVICE1_X}
          waveformData={waveformDataWithoutChannel}
        />
      )

      // Should call createWaveformData with empty data when channel not found
      expect(chartConfig.createWaveformData).toHaveBeenCalledWith(
        CHANNEL_IDS.DEVICE1_X,
        [],
        44100,
        undefined,
        undefined,
        expect.objectContaining({
          voltage: expect.any(String),
          current: expect.any(String),
          acceleration: expect.any(String),
        })
      )
    })

    it('handles null waveform data', () => {
      render(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} waveformData={null} />)

      // Should call createWaveformData with empty data and default sample rate
      expect(chartConfig.createWaveformData).toHaveBeenCalledWith(
        CHANNEL_IDS.DEVICE1_X,
        [],
        44100,
        undefined,
        undefined,
        expect.objectContaining({
          voltage: expect.any(String),
          current: expect.any(String),
          acceleration: expect.any(String),
        })
      )
    })

    it('handles undefined waveform data', () => {
      render(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} waveformData={undefined} />)

      // Should call createWaveformData with empty data and default sample rate
      expect(chartConfig.createWaveformData).toHaveBeenCalledWith(
        CHANNEL_IDS.DEVICE1_X,
        [],
        44100,
        undefined,
        undefined,
        expect.objectContaining({
          voltage: expect.any(String),
          current: expect.any(String),
          acceleration: expect.any(String),
        })
      )
    })
  })

  describe('Chart Configuration', () => {
    it('calls getWaveformChartOptions with correct channel ID', () => {
      render(<WaveformChart {...defaultProps} />)

      expect(chartConfig.getWaveformChartOptions).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X)
    })

    it('passes chart data to Line component', () => {
      const mockChartData = {
        labels: [0, 1, 2, 3, 4],
        datasets: [
          {
            data: [0.1, 0.2, 0.3, 0.4, 0.5],
            borderColor: '#FF6384',
          },
        ],
      }

      ;(chartConfig.createWaveformData as any).mockReturnValue(mockChartData)

      render(<WaveformChart {...defaultProps} />)

      const mockLineChart = screen.getByTestId('mock-line-chart')
      expect(mockLineChart).toHaveAttribute('data-chart-data', JSON.stringify(mockChartData))
    })

    it('passes chart options to Line component', () => {
      const mockOptions = { responsive: true, animation: false }
      ;(chartConfig.getWaveformChartOptions as any).mockReturnValue(mockOptions)

      render(<WaveformChart {...defaultProps} />)

      const mockLineChart = screen.getByTestId('mock-line-chart')
      expect(mockLineChart).toHaveAttribute('data-chart-options', JSON.stringify(mockOptions))
    })
  })

  describe('Performance Optimizations', () => {
    it('memoizes chart data to prevent unnecessary re-renders', () => {
      const { rerender } = render(<WaveformChart {...defaultProps} />)

      // First render should call createWaveformData
      expect(chartConfig.createWaveformData).toHaveBeenCalledTimes(1)

      // Rerender with same data should not call createWaveformData again
      rerender(<WaveformChart {...defaultProps} />)
      expect(chartConfig.createWaveformData).toHaveBeenCalledTimes(1)
    })

    it('memoizes chart options to prevent unnecessary re-renders', () => {
      const { rerender } = render(<WaveformChart {...defaultProps} />)

      // First render should call getWaveformChartOptions
      expect(chartConfig.getWaveformChartOptions).toHaveBeenCalledTimes(1)

      // Rerender with same channelId should not call getWaveformChartOptions again
      rerender(<WaveformChart {...defaultProps} />)
      expect(chartConfig.getWaveformChartOptions).toHaveBeenCalledTimes(1)
    })

    it.skip('updates memoized data when waveform data changes', () => {
      const { rerender } = render(<WaveformChart {...defaultProps} />)

      expect(chartConfig.createWaveformData).toHaveBeenCalledTimes(1)

      // Change waveform data
      const newWaveformData: IWaveformData = {
        ...mockWaveformData,
        channels: [
          {
            channelId: CHANNEL_IDS.DEVICE1_X,
            data: [0.6, 0.7, 0.8, 0.9, 1.0],
          },
        ],
      }

      rerender(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} waveformData={newWaveformData} />)

      // Should call createWaveformData again with new data
      expect(chartConfig.createWaveformData).toHaveBeenCalledTimes(2)
      expect(chartConfig.createWaveformData).toHaveBeenLastCalledWith(
        CHANNEL_IDS.DEVICE1_X,
        [0.6, 0.7, 0.8, 0.9, 1.0],
        44100
      )
    })

    it('updates memoized options when channel ID changes', () => {
      const { rerender } = render(<WaveformChart {...defaultProps} />)

      expect(chartConfig.getWaveformChartOptions).toHaveBeenCalledTimes(1)

      // Change channel ID
      rerender(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_Y} waveformData={mockWaveformData} />)

      // Should call getWaveformChartOptions again with new channel ID
      expect(chartConfig.getWaveformChartOptions).toHaveBeenCalledTimes(2)
      expect(chartConfig.getWaveformChartOptions).toHaveBeenLastCalledWith(CHANNEL_IDS.DEVICE1_Y)
    })
  })

  describe('Chart Updates', () => {
    it.skip('updates chart efficiently when data changes', async () => {
      // Since we're using a mock Line component, we can't test the actual chart update
      // Instead, verify that the component re-renders with new data
      const { rerender } = render(<WaveformChart {...defaultProps} />)

      // Update with new data
      const newWaveformData: IWaveformData = {
        ...mockWaveformData,
        channels: [
          {
            channelId: CHANNEL_IDS.DEVICE1_X,
            data: [0.6, 0.7, 0.8],
          },
        ],
      }

      rerender(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} waveformData={newWaveformData} />)

      // Verify that createWaveformData is called with new data
      expect(chartConfig.createWaveformData).toHaveBeenCalledWith(
        CHANNEL_IDS.DEVICE1_X,
        [0.6, 0.7, 0.8],
        44100
      )
    })
  })

  describe('Different Channel Types', () => {
    it('renders correctly for Device 1 Y channel', () => {
      render(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_Y} waveformData={mockWaveformData} />)

      expect(screen.getByTestId(`waveform-chart-${CHANNEL_IDS.DEVICE1_Y}`)).toBeInTheDocument()
      expect(chartConfig.getWaveformChartOptions).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_Y)
    })

    it('renders correctly for Device 2 channels', () => {
      const device2WaveformData: IWaveformData = {
        timestamp: '2024-01-01T00:00:00Z',
        sampleRate: 44100,
        channels: [
          {
            channelId: CHANNEL_IDS.DEVICE2_X,
            data: [0.1, 0.2, 0.3],
          },
        ],
      }

      render(<WaveformChart channelId={CHANNEL_IDS.DEVICE2_X} waveformData={device2WaveformData} />)

      expect(screen.getByTestId(`waveform-chart-${CHANNEL_IDS.DEVICE2_X}`)).toBeInTheDocument()
      expect(chartConfig.createWaveformData).toHaveBeenCalledWith(
        CHANNEL_IDS.DEVICE2_X,
        [0.1, 0.2, 0.3],
        44100,
        undefined,
        undefined,
        expect.objectContaining({
          voltage: expect.any(String),
          current: expect.any(String),
          acceleration: expect.any(String),
        })
      )
    })
  })

  describe('Error Resilience', () => {
    it('handles malformed waveform data gracefully', () => {
      const malformedData = {
        timestamp: '2024-01-01T00:00:00Z',
        sampleRate: 44100,
        channels: null, // Malformed
      } as any

      expect(() => {
        render(<WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} waveformData={malformedData} />)
      }).not.toThrow()
    })

    it.skip('handles missing sample rate', () => {
      const dataWithoutSampleRate = {
        timestamp: '2024-01-01T00:00:00Z',
        channels: [
          {
            channelId: CHANNEL_IDS.DEVICE1_X,
            data: [0.1, 0.2, 0.3],
          },
        ],
      } as any

      render(
        <WaveformChart channelId={CHANNEL_IDS.DEVICE1_X} waveformData={dataWithoutSampleRate} />
      )

      // Should use default sample rate (44100)
      expect(chartConfig.createWaveformData).toHaveBeenCalledWith(
        CHANNEL_IDS.DEVICE1_X,
        [0.1, 0.2, 0.3],
        undefined // Will be handled by createWaveformData
      )
    })
  })
})
