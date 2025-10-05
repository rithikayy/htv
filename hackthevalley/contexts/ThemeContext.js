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
      background: "#E8D4A2",
      text: "#5C4033",
      buttonBackground: "#D2B48C",
      buttonText: "#5C4033",
      border: "#a58d6fff",
      headerBackground: "#C8A882",
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
      background: "#E8D4A2",      // Warm sand
      text: "#5C4033",            // Dark brown
      buttonBackground: "#D2B48C", // Tan/golden sand
      buttonText: "#5C4033",       // Dark brown
      border: "#a58d6fff",         // Medium brown
      headerBackground: "#C8A882", // Darker sand
    };

    if (highContrast) {
      colors = {
        background: "#FFFFFF",      // White
        text: "#000000",            // Black
        buttonBackground: "#8B4513", // Dark brown (higher contrast)
        buttonText: "#FFFFFF",      // White text
        border: "#000000",          // Black
        headerBackground: "#654321", // Very dark brown
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