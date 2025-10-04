import React, { createContext, useState, useMemo } from "react";

export const ThemeContext = createContext({
  highContrast: false,
  dyslexiaFont: false,
  fontSize: "medium",
  toggleHighContrast: () => {},
  toggleDyslexiaFont: () => {},
  setFontSize: () => {},
  themeStyles: {
    colors: {
      background: "#ffffff",
      text: "#000000",
      buttonBackground: "#4CAF50",
      buttonText: "#ffffff",
    },
    fontFamily: undefined,
    fontSizeMultiplier: 1,
  },
});

export const ThemeProvider = ({ children }) => {
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [fontSize, setFontSize] = useState("medium");

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
        background: "#ffffff",
        text: "#000000",
        buttonBackground: "#000000",
        buttonText: "#ffffff",
      };
    }

    let fontFamily;
    if (dyslexiaFont) {
      fontFamily = "DyslexiaFont";
    }

    // Calculate font size multiplier
    let fontSizeMultiplier = 1;
    if (fontSize === "small") {
      fontSizeMultiplier = 0.95;
    } else if (fontSize === "large") {
      fontSizeMultiplier = 1.25;
    }

    return { colors, fontFamily, fontSizeMultiplier };
  }, [highContrast, dyslexiaFont, fontSize]);

  return (
    <ThemeContext.Provider
      value={{
        highContrast,
        dyslexiaFont,
        fontSize,
        toggleHighContrast,
        toggleDyslexiaFont,
        setFontSize,
        themeStyles,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
