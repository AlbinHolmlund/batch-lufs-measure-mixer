import React, { useState } from 'react';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { useLanguage } from './useLanguage';

const MouseOverPopover = ({ title, children, ...props }) => {
    const { __ } = useLanguage();
    const [anchorEl, setAnchorEl] = useState(null);

    const handlePopoverOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handlePopoverClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    return (
        <div>
            {children({ handlePopoverOpen, handlePopoverClose })}
            <Popover
                id="mouse-over-popover"
                sx={{
                    pointerEvents: 'none',
                }}
                open={open}
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                onClose={handlePopoverClose}
                disableRestoreFocus
                {...props}
            >
                <Typography sx={{ p: 1 }}>
                    {__(title)}
                </Typography>
            </Popover>
        </div>
    );
}

export { MouseOverPopover };