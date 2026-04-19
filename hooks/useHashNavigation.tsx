import { useState, useEffect } from 'react';

/**
 * Hook para manejar la navegación basada en hash.
 * Ideal para entornos donde no se tiene control total sobre el servidor (como iframes).
 */
export const useHashNavigation = () => {
    const [currentHash, setCurrentHash] = useState(window.location.hash || '#/dashboard');

    useEffect(() => {
        const handleHashChange = () => {
            setCurrentHash(window.location.hash || '#/dashboard');
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const navigate = (path: string) => {
        window.location.hash = path;
    };

    return { currentHash, navigate };
};
