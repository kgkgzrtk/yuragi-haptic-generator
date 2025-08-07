import React, { useRef, useEffect, useMemo } from 'react'
import { logger } from '@/utils/logger'
import './AccelerationTrajectory.css'

interface AccelerationTrajectoryProps {
  deviceId: 1 | 2
  xData: number[]
  yData: number[]
  maxPoints?: number
}

export const AccelerationTrajectory: React.FC<AccelerationTrajectoryProps> = ({
  deviceId,
  xData,
  yData,
  maxPoints = 100,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trajectoryRef = useRef<{ x: number; y: number }[]>([])

  // Calculate trajectory points from acceleration data
  const trajectoryPoints = useMemo(() => {
    if (!xData?.length || !yData?.length) {
      return []
    }

    // Ensure arrays are valid
    if (!Array.isArray(xData) || !Array.isArray(yData)) {
      logger.warn('Invalid data provided to AccelerationTrajectory', {
        xDataType: typeof xData,
        yDataType: typeof yData,
        xDataLength: xData?.length,
        yDataLength: yData?.length,
      })
      return []
    }

    const minLength = Math.min(xData.length, yData.length)
    const points: { x: number; y: number }[] = []

    for (let i = 0; i < minLength; i++) {
      // Validate data points
      const x = xData[i]
      const y = yData[i]

      if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
        points.push({
          x: x,
          y: y,
        })
      }
    }

    // Keep only the last maxPoints
    return points.slice(-maxPoints)
  }, [xData, yData, maxPoints])

  useEffect(() => {
    trajectoryRef.current = trajectoryPoints
  }, [trajectoryPoints])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    try {
      // Set canvas size
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        // Canvas has no size, skip rendering
        return
      }

      canvas.width = rect.width
      canvas.height = rect.height

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const scale = Math.min(canvas.width, canvas.height) * 0.4

      // Draw grid
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 1

      // X axis
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(canvas.width, centerY)
      ctx.stroke()

      // Y axis
      ctx.beginPath()
      ctx.moveTo(centerX, 0)
      ctx.lineTo(centerX, canvas.height)
      ctx.stroke()

      // Draw circular grid lines
      ctx.strokeStyle = '#f0f0f0'
      for (let r = 0.2; r <= 1; r += 0.2) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, scale * r, 0, 2 * Math.PI)
        ctx.stroke()
      }

      // Draw trajectory
      if (trajectoryRef.current.length > 1) {
        ctx.lineWidth = 2

        for (let i = 1; i < trajectoryRef.current.length; i++) {
          const prevPoint = trajectoryRef.current[i - 1]
          const currPoint = trajectoryRef.current[i]

          // Calculate color based on position in trajectory (gradient effect)
          const progress = i / trajectoryRef.current.length
          const hue = progress * 60 + 180 // Blue to cyan gradient
          const opacity = 0.3 + progress * 0.7

          ctx.strokeStyle = `hsla(${hue}, 70%, 50%, ${opacity})`

          ctx.beginPath()
          ctx.moveTo(
            centerX + prevPoint.x * scale,
            centerY - prevPoint.y * scale // Negative for correct Y direction
          )
          ctx.lineTo(centerX + currPoint.x * scale, centerY - currPoint.y * scale)
          ctx.stroke()
        }

        // Draw current position marker
        const lastPoint = trajectoryRef.current[trajectoryRef.current.length - 1]
        ctx.fillStyle = '#45B7D1'
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2

        ctx.beginPath()
        ctx.arc(centerX + lastPoint.x * scale, centerY - lastPoint.y * scale, 6, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
      }

      // Draw axis labels
      ctx.fillStyle = '#666'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      ctx.fillText('X', canvas.width - 20, centerY - 10)
      ctx.fillText('Y', centerX + 10, 20)

      // Draw scale indicators
      ctx.fillStyle = '#999'
      ctx.font = '10px sans-serif'

      ctx.fillText('1', centerX + scale + 5, centerY + 15)
      ctx.fillText('-1', centerX - scale - 20, centerY + 15)
      ctx.fillText('1', centerX - 25, centerY - scale)
      ctx.fillText('-1', centerX - 25, centerY + scale)
    } catch (error) {
      logger.error('Error rendering acceleration trajectory', {
        deviceId,
        error: error instanceof Error ? error.message : error,
      })
    }
  }, [trajectoryPoints, deviceId])

  return (
    <div className='acceleration-trajectory' data-testid={`acceleration-trajectory-${deviceId}`}>
      <h3 className='trajectory-title'>Device {deviceId} Acceleration Trajectory</h3>
      <div className='trajectory-canvas-container'>
        <canvas ref={canvasRef} className='trajectory-canvas' />
      </div>
    </div>
  )
}

export default AccelerationTrajectory
