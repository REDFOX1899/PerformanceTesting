import React, { useEffect, useState } from 'react';
import { getBackgroundPage } from '../common/extension';

const TransactionControls: React.FC = () => {
    const background = getBackgroundPage();

    const [recordingState, setRecordingState] = useState('');

    useEffect(() => {
        chrome.runtime.sendMessage({ command: 'check_status' }).then((response) => setRecordingState(response.recording)).catch(() => {});

        function notificationListener(request: any) {
            switch (request.command) {
                case 'recorderNotification':
                    setRecordingState(request.observable.recording);
                    break;
            }
        }

        chrome.runtime.onMessage.addListener(notificationListener);
        return () => chrome.runtime.onMessage.removeListener(notificationListener);
    }, []);

    const canStop = recordingState !== 'stopped';
    const canPause = recordingState === 'record';
    const canResume = recordingState === 'pause';

    const stopRecording = () => {
        chrome.runtime.sendMessage({ command: 'stop_recording' }).then(() => {}).catch(() => {});
        chrome.runtime.sendMessage({ type: 'stop_traffic' }).then(() => {}).catch(() => {});
    };

    const resumeRecording = () => {
        chrome.runtime.sendMessage({ command: 'resume_recording' }).then(() => {}).catch(() => {});
        chrome.runtime.sendMessage({ type: 'start_traffic' }).then(() => {}).catch(() => {});
    };

    const pauseRecording = () => {
        chrome.runtime.sendMessage({ command: 'pause_recording' }).then(() => {}).catch(() => {});
        chrome.runtime.sendMessage({ type: 'pause_traffic' }).then(() => {}).catch(() => {});
    };

    return (
        <>
            {canStop && (
                <button className='btn btn-stop' title='Stop recording' onClick={stopRecording}>
                    <i className='fa fa-stop' />
                </button>
            )}

            {canPause && (
                <button className='btn btn-pause' title='Pause recording' onClick={pauseRecording}>
                    <i className='fa fa-pause' />
                </button>
            )}

            {canResume && (
                <button className='btn btn-resume' title='Resume recording' onClick={resumeRecording}>
                    <i className='fa fa-circle' />
                </button>
            )}
        </>
    );
};

export default TransactionControls;
