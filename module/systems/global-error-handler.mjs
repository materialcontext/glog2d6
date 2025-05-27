// module/systems/global-error-handler.mjs
export function setupGlobalErrorHandler() {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('🚨 Unhandled Promise Rejection:', event.reason);

        // Try to identify if it's from our system
        if (event.reason?.stack?.includes('glog2d6')) {
            ui.notifications.error(`GLOG2D6 System Error: ${event.reason.message}`, { permanent: true });

            // Log detailed info
            console.group('🚨 GLOG2D6 Unhandled Rejection');
            console.error('Reason:', event.reason);
            console.error('Stack:', event.reason.stack);
            console.error('Promise:', event.promise);
            console.groupEnd();
        }
    });

    // Catch general errors
    window.addEventListener('error', (event) => {
        if (event.filename?.includes('glog2d6')) {
            console.error('🚨 GLOG2D6 Script Error:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        }
    });
}
