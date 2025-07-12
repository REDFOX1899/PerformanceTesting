import React from 'react';

const Header = () => {
    return (
        <header className='header'>
            <a href='#' title='Go to dashboard' className='header-logo' />
            <button type='button' className='close-page btn btn-primary' onClick={window.close}>
                Close
            </button>
        </header>
    );
};

export default Header;
