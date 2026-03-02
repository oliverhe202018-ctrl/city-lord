self.addEventListener('push', function (event: any) {
    if (event.data) {
        let data;
        try {
            data = event.data.json()
        } catch (e) {
            data = { title: '活动提醒', body: event.data.text() }
        }
        const options = {
            body: data.body,
            icon: data.icon || '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
                url: data.url || '/',
            },
        }
        event.waitUntil((self as any).registration.showNotification(data.title || '活动提醒', options))
    }
})

self.addEventListener('notificationclick', function (event: any) {
    console.log('Notification click received.')
    event.notification.close()

    if (event.notification.data && event.notification.data.url) {
        event.waitUntil((self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr: any[]) => {
            // If a window is already open, focus it
            for (const client of clientsArr) {
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus()
                }
            }
            // Otherwise open a new window
            if ((self as any).clients.openWindow) {
                return (self as any).clients.openWindow(event.notification.data.url)
            }
        }))
    }
})
