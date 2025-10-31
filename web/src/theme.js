// File: web/src/theme.js
import { createTheme } from '@mui/material/styles';

// สร้าง theme object
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // สีน้ำเงินหลัก
    },
    secondary: {
      main: '#dc004e', // สีรอง
    },
    background: {
      default: '#f4f6f8', // สีพื้นหลัง
      paper: '#ffffff', // สีของ Card
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h5: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        },
      },
    },
  },
});

export default theme;