import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
} from 'react';

type User = {
    id: number;
    nama: string;
    jabatan: string;
    cabang: string;
};

type AuthContextType = {
    user: User | null;
    setUser: (user: User | null) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(
    undefined
);

export function AuthProvider({
    children,
    }: {
    children: ReactNode;
    }) {
    const [user, setUser] = useState<User | null>(null);

    const logout = () => {
        setUser(null);
    };

    return (
        <AuthContext.Provider
        value={{ user, setUser, logout }}
        >
        {children}
        </AuthContext.Provider>
    );
    }

    export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
        'useAuth must be used inside AuthProvider'
        );
    }

    return context;
}
