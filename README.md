# Getnet Chile Web Checkout Integration (Prototype)

This is a simple Node.js/Express application to demonstrate the integration with Getnet Chile's Web Checkout API (PlaceToPay).

## Key Documentation
The successful integration and test credentials were based on the official Getnet Manual:
**[GETNET - MANUAL COMPLETO (PDF)](https://banco.santander.cl/uploads/000/033/227/ce392ca6-ad03-43ca-b354-99c45a5c5a1b/original/GETNET_-_MANUAL_COMPLETO.pdf)**

This document contains:
- **Test Credentials** (Login & Trankey)
- **Endpoints** for Test and Production environments
- **Integration flows** and technical specifications

## Project Setup

### Prerequisites
- Node.js installed

### Installation
1.  Clone this repository or download the files.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the App
1.  Start the server:
    ```bash
    node index.js
    ```
2.  Open your browser and navigate to:
    `http://localhost:3000`
3.  Click the **"Pagar $5.000"** button to generate a payment session.

## Configuration
The project is currently configured for the **Test Environment** in `index.js`:

```javascript
// Public Test Credentials for Getnet Chile
const LOGIN = '7ffbb7bf1f7361b1200b2e8d74e1d76f';
const SECRET_KEY = 'SnZP3D63n3I9dH9O';
const GETNET_URL = 'https://checkout.test.getnet.cl';
```

To switch to **Production**:
1.  Update `GETNET_URL` to `https://checkout.getnet.cl`.
2.  Replace `LOGIN` and `SECRET_KEY` with your production credentials obtained from the Getnet Portal.
