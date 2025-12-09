// ========================================
// EJEMPLO: Cómo usar paymentSuccessful()
// ========================================

/**
 * Este archivo muestra ejemplos de cómo implementar
 * tu lógica de negocio en la función paymentSuccessful()
 */

// EJEMPLO 1: Enviar email de confirmación
// ==========================================
async function paymentSuccessful(transactionId) {
    console.log(`✅ [PAYMENT SUCCESSFUL] Transaction ID: ${transactionId}`);
    
    // 1. Obtener detalles del pago
    const payment = await Payment.findOne({ requestId: transactionId });
    
    if (!payment) {
        console.error('Payment not found:', transactionId);
        return;
    }
    
    // 2. Enviar email al comprador
    await sendConfirmationEmail({
        to: payment.buyer.email,
        subject: '✅ Pago Confirmado',
        html: `
            <h1>¡Pago Exitoso!</h1>
            <p>Hola ${payment.buyer.name},</p>
            <p>Tu pago de <strong>CLP $${payment.amount.toLocaleString()}</strong> ha sido procesado correctamente.</p>
            <p>Referencia: ${payment.reference}</p>
            <p>ID de transacción: ${transactionId}</p>
        `
    });
    
    // 3. Activar servicio/producto
    await activateService(payment);
    
    // 4. Registrar en logs
    await logToDB('INFO', {
        message: 'Payment successful - Email sent and service activated',
        requestId: transactionId,
        email: payment.buyer.email,
        timestamp: new Date()
    });
}

// EJEMPLO 2: Activar membresía o servicio
// ==========================================
async function activateService(payment) {
    // Buscar usuario por email
    const user = await User.findOne({ email: payment.buyer.email });
    
    if (user) {
        // Activar membresía premium
        user.isPremium = true;
        user.premiumUntil = moment().add(1, 'month').toDate();
        user.lastPaymentId = payment.requestId;
        await user.save();
        
        console.log(`✅ Premium activated for user: ${user.email}`);
    }
}

// EJEMPLO 3: Actualizar inventario (productos físicos)
// ======================================================
async function paymentSuccessful(transactionId) {
    const payment = await Payment.findOne({ requestId: transactionId });
    
    // Obtener items del pedido (si guardaste items en payment.metadata)
    const items = payment.metadata?.items || [];
    
    for (const item of items) {
        // Reducir stock
        await Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: -item.quantity } }
        );
        
        console.log(`📦 Stock updated for product ${item.productId}: -${item.quantity}`);
    }
    
    // Crear orden de envío
    await ShippingOrder.create({
        paymentId: transactionId,
        reference: payment.reference,
        buyer: payment.buyer,
        items: items,
        status: 'PENDING_SHIPMENT',
        createdAt: new Date()
    });
    
    console.log(`🚚 Shipping order created for ${transactionId}`);
}

// EJEMPLO 4: Sistema de puntos/rewards
// ======================================
async function paymentSuccessful(transactionId) {
    const payment = await Payment.findOne({ requestId: transactionId });
    
    // Dar puntos: 1 punto por cada 100 CLP
    const points = Math.floor(payment.amount / 100);
    
    await User.updateOne(
        { email: payment.buyer.email },
        { 
            $inc: { rewardPoints: points },
            $push: { 
                pointsHistory: {
                    transactionId,
                    points,
                    date: new Date(),
                    description: `Pago ${payment.reference}`
                }
            }
        }
    );
    
    console.log(`⭐ ${points} points added for user ${payment.buyer.email}`);
}

// EJEMPLO 5: Notificar a otros sistemas (Webhook saliente)
// ==========================================================
async function paymentSuccessful(transactionId) {
    const payment = await Payment.findOne({ requestId: transactionId });
    
    // Notificar a tu ERP, CRM, u otros sistemas
    try {
        await axios.post('https://tu-erp.com/api/payment-received', {
            transactionId,
            reference: payment.reference,
            amount: payment.amount,
            currency: payment.currency,
            buyer: payment.buyer,
            timestamp: new Date()
        }, {
            headers: {
                'Authorization': 'Bearer YOUR_API_KEY',
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`📤 Payment notification sent to ERP`);
    } catch (error) {
        console.error('Error notifying ERP:', error.message);
        // No fallar el proceso principal
    }
}

// EJEMPLO 6: Generar factura automática
// =======================================
async function paymentSuccessful(transactionId) {
    const payment = await Payment.findOne({ requestId: transactionId });
    
    // Crear factura
    const invoice = await Invoice.create({
        invoiceNumber: generateInvoiceNumber(),
        transactionId,
        reference: payment.reference,
        buyer: {
            name: payment.buyer.name,
            email: payment.buyer.email,
            rut: payment.buyer.document
        },
        items: [
            {
                description: payment.getnetResponse.payment.description,
                amount: payment.amount
            }
        ],
        subtotal: payment.amount,
        tax: 0,
        total: payment.amount,
        status: 'PAID',
        paidAt: new Date(),
        createdAt: new Date()
    });
    
    // Generar PDF
    const pdfBuffer = await generateInvoicePDF(invoice);
    
    // Enviar por email
    await sendEmail({
        to: payment.buyer.email,
        subject: `Factura ${invoice.invoiceNumber}`,
        attachments: [{
            filename: `factura-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer
        }]
    });
    
    console.log(`📄 Invoice ${invoice.invoiceNumber} generated and sent`);
}

// EJEMPLO 7: COMPLETO - Combinando todo
// =======================================
async function paymentSuccessful(transactionId) {
    console.log(`✅ [PAYMENT SUCCESSFUL] Transaction ID: ${transactionId}`);
    
    try {
        // 1. Obtener pago
        const payment = await Payment.findOne({ requestId: transactionId });
        
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // 2. Actualizar usuario
        const user = await User.findOne({ email: payment.buyer.email });
        if (user) {
            user.isPremium = true;
            user.premiumUntil = moment().add(1, 'month').toDate();
            await user.save();
        }
        
        // 3. Generar factura
        const invoice = await generateInvoice(payment);
        
        // 4. Enviar emails
        await Promise.all([
            sendConfirmationEmail(payment, invoice),
            sendAdminNotification(payment)
        ]);
        
        // 5. Actualizar inventario (si aplica)
        if (payment.metadata?.items) {
            await updateInventory(payment.metadata.items);
        }
        
        // 6. Dar puntos de recompensa
        await addRewardPoints(payment.buyer.email, payment.amount);
        
        // 7. Notificar sistemas externos
        await notifyExternalSystems(payment);
        
        // 8. Registrar en logs
        await logToDB('INFO', {
            message: 'Payment processed successfully - All actions completed',
            requestId: transactionId,
            actions: [
                'user_updated',
                'invoice_generated',
                'emails_sent',
                'inventory_updated',
                'points_added',
                'external_notified'
            ],
            timestamp: new Date()
        });
        
        console.log(`✅ All payment actions completed for ${transactionId}`);
        
    } catch (error) {
        console.error(`❌ Error processing payment ${transactionId}:`, error.message);
        
        // Registrar error pero NO fallar el proceso
        await logToDB('ERROR', {
            message: 'Error in paymentSuccessful',
            requestId: transactionId,
            error: error.message,
            stack: error.stack,
            timestamp: new Date()
        });
        
        // Notificar al admin del error
        await sendAdminAlert({
            subject: `Error procesando pago ${transactionId}`,
            error: error.message
        });
    }
}

// ========================================
// FUNCIONES AUXILIARES (ejemplos)
// ========================================

async function sendConfirmationEmail(payment, invoice) {
    // Tu lógica de email (Nodemailer, SendGrid, etc.)
    console.log(`📧 Sending confirmation email to ${payment.buyer.email}`);
}

async function sendAdminNotification(payment) {
    // Notificar al admin
    console.log(`📧 Notifying admin about payment ${payment.requestId}`);
}

async function updateInventory(items) {
    for (const item of items) {
        await Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: -item.quantity } }
        );
    }
}

async function addRewardPoints(email, amount) {
    const points = Math.floor(amount / 100);
    await User.updateOne(
        { email },
        { $inc: { rewardPoints: points } }
    );
}

async function notifyExternalSystems(payment) {
    // Webhook a ERP, CRM, etc.
    console.log(`📤 Notifying external systems`);
}

async function generateInvoice(payment) {
    return {
        invoiceNumber: `INV-${Date.now()}`,
        transactionId: payment.requestId,
        amount: payment.amount
    };
}

function generateInvoiceNumber() {
    return `INV-${Date.now()}`;
}

async function sendAdminAlert(alert) {
    console.log(`🚨 Admin alert: ${alert.subject}`);
}
