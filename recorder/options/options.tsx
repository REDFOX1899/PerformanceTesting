import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { GlobalSettings } from '../common/extension';
import { validUrl } from '../common/url-utils';
import Header from './header';
import { loadSettings, resetSettings, saveSettings } from './helpers';
import { useNotifications } from './hooks';
import {
    CONFIRM_RESET_VALUES,
    ERROR_SPECIFY_VALID_URL,
    MESSAGE_SETTINGS_RESET,
    MESSAGE_SETTINGS_SAVED,
} from './messages';
import SubHeader from './sub-header';

const Options: React.FC = () => {
    const { showNotification, component } = useNotifications();
    const { register, watch, handleSubmit, reset: resetForm, errors } = useForm<GlobalSettings>();
    const customServer = watch('custom_server');
    const customArd = watch('custom_ard');
    const onSubmit = (data: GlobalSettings) => {
        saveSettings(data)
            .then(resetForm)
            .then(() => chrome.runtime.sendMessage({ op: 'reloadoptions' }).catch(() => {}))
            .then(() => showNotification(MESSAGE_SETTINGS_SAVED, 'success'));
    };
    const onReset = () => {
        if (confirm(CONFIRM_RESET_VALUES)) {
            resetSettings()
                .then(resetForm)
                .then(() => chrome.runtime.sendMessage({ op: 'reloadoptions' }).catch(() => {}))
                .then(() => showNotification(MESSAGE_SETTINGS_RESET, 'success'));
        }
    };

    useEffect(() => {
        loadSettings().then(resetForm);
    }, []);

    return (
        <>
            {component}
            <Header />
            <SubHeader />
            <form className='boxes' onSubmit={handleSubmit(onSubmit)}>
                <div className='form-group'>
                    <input type='checkbox' id='debug' name='debug' ref={register} />
                    <label className='checkbox' htmlFor='debug'>
                        <span>Enable Debug mode</span>
                    </label>
                </div>

                <div className='form-group'>
                    <input type='checkbox' id='custom_server' name='custom_server' ref={register} />
                    <label className='checkbox' htmlFor='custom_server'>
                        Custom Server URL {customServer && <span className='required'>*</span>}
                    </label>
                </div>

                {customServer && (
                    <div className='form-group'>
                        <input
                            type='text'
                            className={errors.server && 'has-error'}
                            id='server'
                            name='server'
                            ref={register({ validate: (x) => validUrl(x) })}
                        />
                        {errors.server && <p>{ERROR_SPECIFY_VALID_URL}</p>}
                    </div>
                )}

                <div className='form-group'>
                    <input type='checkbox' id='custom_ard' name='custom_ard' ref={register} />
                    <label className='checkbox' htmlFor='custom_ard'>
                        Custom ARD URL {customArd && <span className='required'>*</span>}
                    </label>
                </div>

                {customArd && (
                    <div className='form-group'>
                        <input
                            className={errors.ard_url && 'has-error'}
                            type='text'
                            id='ard_url'
                            name='ard_url'
                            ref={register({
                                validate: (x) => validUrl(x),
                            })}
                        />
                        {errors.ard_url && <p>{ERROR_SPECIFY_VALID_URL}</p>}
                    </div>
                )}

                <div className='form-group'>
                    <label htmlFor='serverJMX'>
                        Server Converter <span className='required'>*</span>
                    </label>
                    <br />
                    <input
                        className={errors.serverJMX && 'has-error'}
                        style={{ marginTop: '.5rem' }}
                        type='text'
                        id='serverJMX'
                        name='serverJMX'
                        ref={register({ validate: (x) => validUrl(x) })}
                    />
                    {errors.serverJMX && <p>{ERROR_SPECIFY_VALID_URL}</p>}
                </div>

                <button type='submit' className='btn btn-primary mr-1'>
                    Save
                </button>

                <button type='button' className='btn btn-primary' onClick={onReset}>
                    Reset
                </button>
            </form>
        </>
    );
};

export default Options;
