import React, { createContext, useState, useMemo } from "react";

export const ThemeContext = createContext({
  highContrast: false,
  dyslexiaFont: false,
  toggleHighContrast: () => {},
  toggleDyslexiaFont: () => {},
  themeStyles: {
    colors: {
      background: "#ffffff",
      text: "#000000",
      buttonBackground: "#4CAF50",
      buttonText: "#ffffff",
    },
    fontFamily: undefined,
  },
});

export const ThemeProvider = ({ children }) => {
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);

  const toggleHighContrast = () => setHighContrast((h) => !h);
  const toggleDyslexiaFont = () => setDyslexiaFont((d) => !d);

  const themeStyles = useMemo(() => {
    let colors = {
      background: "#f5f5f5",
      text: "#333333",
      buttonBackground: "#4CAF50",
      buttonText: "#ffffff",
    };
    if (highContrast) {
      colors = {
        background: "#000000",
        text: "#ffffff",
        buttonBackground: "#ffff00",
        buttonText: "#000000",
      };
    }
    let fontFamily;
    if (dyslexiaFont) {
      fontFamily = "DyslexiaFont";
    }
    return { colors, fontFamily };
  }, [highContrast, dyslexiaFont]);

  return (
    <ThemeContext.Provider
      value={{
        highContrast,
        dyslexiaFont,
        toggleHighContrast,
        toggleDyslexiaFont,
        themeStyles,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
