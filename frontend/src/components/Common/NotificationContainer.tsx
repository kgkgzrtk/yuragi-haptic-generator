/**
 * Simple notification container for displaying error and status messages
 */
import React from 'react'
import { useNotifications } from '@/hooks/useErrorHandler'
import { Button } from './Button'

export const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification, clearAll } = useNotifications()

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className='notification-container'>
      {notifications.length > 1 && (
        <div className='notification-header'>
          <span>{notifications.length} notifications</span>
          <Button onClick={clearAll} variant='secondary' size='small'>
            Clear All
          </Button>
        </div>
      )}

      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`notification notification--${notification.type}`}
          role='alert'
        >
          <div className='notification-content'>
            <h4 className='notification-title'>{notification.title}</h4>
            <p className='notification-message'>{notification.message}</p>
          </div>

          <div className='notification-actions'>
            {notification.action && (
              <Button
                onClick={() => {
                  notification.action!.handler()
                  removeNotification(notification.id)
                }}
                variant='primary'
                size='small'
              >
                {notification.action.label}
              </Button>
            )}

            <Button
              onClick={() => removeNotification(notification.id)}
              variant='secondary'
              size='small'
              aria-label='Dismiss notification'
            >
              ×
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default NotificationContainer
