import { createContext, useState } from "react";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);

  return (
    <ThemeContext.Provider
      value={{ highContrast, setHighContrast, dyslexiaFont, setDyslexiaFont }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
