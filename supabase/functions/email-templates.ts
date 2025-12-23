export const getEmailTemplate = (type: string, data: any): { subject: string; html: string } => {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
      .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
      .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .product-item { display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #dee2e6; }
      .product-item:last-child { border-bottom: none; }
      .product-image { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; margin-right: 15px; }
      .total { font-size: 20px; font-weight: bold; color: #667eea; margin-top: 15px; }
      .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
      .unsubscribe a { color: #6c757d; }
    </style>
  `;

  switch (type) {
    case 'welcome':
      return {
        subject: 'Welcome to Beckah Marketplace! 🎉',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Beckah!</h1>
              </div>
              <div class="content">
                <h2>Hi ${data.fullName || 'there'}! 👋</h2>
                <p>We're thrilled to have you join our marketplace community!</p>
                <p>Beckah is your destination for discovering unique, quality products from sellers around the world. Whether you're looking to buy or sell, we've got you covered.</p>

                <h3>Here's what you can do:</h3>
                <ul>
                  <li><strong>Shop</strong> from a curated selection of products</li>
                  <li><strong>Sell</strong> your own items and reach thousands of buyers</li>
                  <li><strong>Track</strong> your orders in real-time</li>
                  <li><strong>Connect</strong> with a vibrant community</li>
                </ul>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}" class="button">Start Shopping</a>
                </div>

                <p>Need help? Our support team is always here to assist you.</p>
                <p>Happy shopping!</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <p>Your trusted marketplace for quality products</p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'order_confirmation':
      return {
        subject: `Order Confirmed - #${data.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Order Confirmed! ✓</h1>
              </div>
              <div class="content">
                <h2>Thank you for your order!</h2>
                <p>Hi ${data.customerName},</p>
                <p>We've received your order and it's being processed. You'll receive another email when your items are shipped.</p>

                <div class="order-details">
                  <h3>Order Details</h3>
                  <p><strong>Order ID:</strong> #${data.orderId}</p>
                  <p><strong>Order Date:</strong> ${data.orderDate}</p>
                  <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>

                  <h3 style="margin-top: 20px;">Items:</h3>
                  ${data.items.map((item: any) => `
                    <div class="product-item">
                      <img src="${item.image_url}" alt="${item.title}" class="product-image">
                      <div style="flex: 1;">
                        <div><strong>${item.title}</strong></div>
                        <div style="color: #6c757d;">Quantity: ${item.quantity}</div>
                        <div style="color: #667eea; font-weight: 600;">$${item.price.toFixed(2)}</div>
                      </div>
                    </div>
                  `).join('')}

                  <div class="total">
                    Total: $${data.totalAmount.toFixed(2)}
                  </div>

                  <h3 style="margin-top: 20px;">Shipping Address:</h3>
                  <p>${data.shippingAddress}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/orders/${data.orderId}" class="button">Track Order</a>
                </div>

                <p>Questions? Contact our support team anytime.</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'shipping_notification':
      return {
        subject: `Your Order Has Shipped! - #${data.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Order Shipped! 📦</h1>
              </div>
              <div class="content">
                <h2>Your order is on its way!</h2>
                <p>Hi ${data.customerName},</p>
                <p>Great news! Your order has been shipped and is heading your way.</p>

                <div class="order-details">
                  <h3>Shipping Details</h3>
                  <p><strong>Order ID:</strong> #${data.orderId}</p>
                  <p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
                  <p><strong>Carrier:</strong> ${data.shippingCompany}</p>
                  ${data.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>` : ''}

                  <h3 style="margin-top: 20px;">Items Shipped:</h3>
                  ${data.items.map((item: any) => `
                    <div class="product-item">
                      <img src="${item.image_url}" alt="${item.title}" class="product-image">
                      <div style="flex: 1;">
                        <div><strong>${item.title}</strong></div>
                        <div style="color: #6c757d;">Quantity: ${item.quantity}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/orders/${data.orderId}" class="button">Track Shipment</a>
                </div>

                <p>You can track your package using the tracking number provided above.</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'delivery_confirmation':
      return {
        subject: `Order Delivered! How was your experience? - #${data.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Order Delivered! 🎉</h1>
              </div>
              <div class="content">
                <h2>Your order has been delivered!</h2>
                <p>Hi ${data.customerName},</p>
                <p>Your order has been successfully delivered. We hope you love your purchase!</p>

                <div class="order-details">
                  <p><strong>Order ID:</strong> #${data.orderId}</p>
                  <p><strong>Delivery Date:</strong> ${data.deliveryDate}</p>
                </div>

                <h3>How was your experience?</h3>
                <p>We'd love to hear your feedback! Taking a moment to review your purchase helps other shoppers and supports our sellers.</p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/orders/${data.orderId}" class="button">Leave a Review</a>
                </div>

                <p>Thank you for shopping with Beckah!</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'abandoned_cart':
      return {
        subject: 'You left items in your cart! 🛒',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Don't Miss Out!</h1>
              </div>
              <div class="content">
                <h2>You left some items behind...</h2>
                <p>Hi ${data.customerName},</p>
                <p>We noticed you left ${data.itemCount} item${data.itemCount > 1 ? 's' : ''} in your cart. They're still waiting for you!</p>

                <div class="order-details">
                  <h3>Your Cart:</h3>
                  ${data.items.map((item: any) => `
                    <div class="product-item">
                      <img src="${item.image_url}" alt="${item.title}" class="product-image">
                      <div style="flex: 1;">
                        <div><strong>${item.title}</strong></div>
                        <div style="color: #6c757d;">Quantity: ${item.quantity}</div>
                        <div style="color: #667eea; font-weight: 600;">$${item.price.toFixed(2)}</div>
                      </div>
                    </div>
                  `).join('')}

                  <div class="total">
                    Total: $${data.totalAmount.toFixed(2)}
                  </div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/checkout" class="button">Complete Your Purchase</a>
                </div>

                <p>Complete your order now before these items are gone!</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'review_request':
      return {
        subject: 'How was your recent purchase? ⭐',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Share Your Experience</h1>
              </div>
              <div class="content">
                <h2>How did we do?</h2>
                <p>Hi ${data.customerName},</p>
                <p>It's been a week since you received your order. We'd love to hear what you think!</p>

                <div class="order-details">
                  <h3>Your Recent Purchase:</h3>
                  <div class="product-item">
                    <img src="${data.product.image_url}" alt="${data.product.title}" class="product-image">
                    <div style="flex: 1;">
                      <div><strong>${data.product.title}</strong></div>
                      <div style="color: #6c757d;">Order #${data.orderId}</div>
                    </div>
                  </div>
                </div>

                <h3 style="text-align: center;">Rate Your Experience:</h3>
                <div style="text-align: center; font-size: 32px; margin: 20px 0;">
                  <a href="${data.siteUrl}/review/${data.orderId}?rating=5" style="text-decoration: none; margin: 0 5px;">⭐</a>
                  <a href="${data.siteUrl}/review/${data.orderId}?rating=4" style="text-decoration: none; margin: 0 5px;">⭐</a>
                  <a href="${data.siteUrl}/review/${data.orderId}?rating=3" style="text-decoration: none; margin: 0 5px;">⭐</a>
                  <a href="${data.siteUrl}/review/${data.orderId}?rating=2" style="text-decoration: none; margin: 0 5px;">⭐</a>
                  <a href="${data.siteUrl}/review/${data.orderId}?rating=1" style="text-decoration: none; margin: 0 5px;">⭐</a>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/review/${data.orderId}" class="button">Write a Review</a>
                </div>

                <p>Your feedback helps other shoppers and supports our sellers. Thank you!</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'payment_transferred_to_seller':
      return {
        subject: `Payment Transferred - Order #${data.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Payment Transferred! 💰</h1>
              </div>
              <div class="content">
                <h2>Great news! Your payment has been transferred!</h2>
                <p>Hi ${data.sellerName},</p>
                <p>We're pleased to inform you that the payment for your order has been successfully transferred to your bank account.</p>

                <div class="order-details">
                  <h3>Payment Details</h3>
                  <p><strong>Order ID:</strong> #${data.orderId}</p>
                  <p><strong>Transfer Date:</strong> ${data.transferDate}</p>

                  <h3 style="margin-top: 20px;">Payment Breakdown:</h3>
                  <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                      <span style="color: #6c757d;">Order Total:</span>
                      <span style="font-weight: 600; color: #212529;">$${data.totalAmount.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                      <span style="color: #6c757d;">Platform Commission (${data.commissionRate}%):</span>
                      <span style="font-weight: 600; color: #dc3545;">-$${data.commission.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 12px 0; background-color: #d4edda; margin: 10px -15px -15px; padding-left: 15px; padding-right: 15px; border-radius: 0 0 6px 6px;">
                      <span style="font-weight: 700; color: #155724;">Amount Transferred:</span>
                      <span style="font-weight: 700; font-size: 20px; color: #155724;">$${data.sellerAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  ${data.transferNotes ? `
                    <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                      <p style="margin: 0; font-weight: 600; color: #495057; margin-bottom: 8px;">Transfer Notes:</p>
                      <p style="margin: 0; color: #6c757d;">${data.transferNotes}</p>
                    </div>
                  ` : ''}
                </div>

                <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <p style="margin: 0; color: #004085; font-size: 14px;">
                    <strong>Important:</strong> The funds should appear in your registered bank account within 1-2 business days depending on your bank's processing time.
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/seller-orders" class="button">View Order Details</a>
                </div>

                <p>Thank you for being a valued seller on Beckah Marketplace!</p>
                <p>If you have any questions about this payment, please don't hesitate to contact our support team.</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <p>Supporting sellers worldwide</p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'product_submission_to_admin':
      return {
        subject: `New Product Submission - ${data.productTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Product Submission 📦</h1>
              </div>
              <div class="content">
                <h2>A new product requires your review</h2>
                <p>Hi Admin,</p>
                <p>A seller has submitted a new product for approval. Please review it at your earliest convenience.</p>

                <div class="order-details">
                  <h3>Product Details</h3>
                  <p><strong>Submission ID:</strong> #${data.submissionId}</p>
                  <p><strong>Product Title:</strong> ${data.productTitle}</p>
                  <p><strong>Seller:</strong> ${data.sellerName}</p>
                  <p><strong>Seller Email:</strong> ${data.sellerEmail}</p>
                  <p><strong>Price:</strong> $${data.price}</p>
                  <p><strong>Submission Type:</strong> ${data.submissionType}</p>
                  <p><strong>Submitted:</strong> ${data.submittedDate}</p>

                  ${data.description ? `
                    <h3 style="margin-top: 20px;">Description:</h3>
                    <p style="color: #6c757d;">${data.description}</p>
                  ` : ''}

                  ${data.images && data.images.length > 0 ? `
                    <h3 style="margin-top: 20px;">Product Images:</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                      ${data.images.slice(0, 3).map((img: string) => `
                        <img src="${img}" alt="Product" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;">
                      `).join('')}
                    </div>
                  ` : ''}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/admin/dashboard" class="button">Review Submission</a>
                </div>

                <p>Please approve or reject this submission as soon as possible.</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'product_approved':
      return {
        subject: `Product Approved - ${data.productTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Product Approved! ✅</h1>
              </div>
              <div class="content">
                <h2>Great news! Your product has been approved!</h2>
                <p>Hi ${data.sellerName},</p>
                <p>We're excited to let you know that your product submission has been approved and is now live on the marketplace!</p>

                <div class="order-details">
                  <h3>Product Details</h3>
                  <p><strong>Product Title:</strong> ${data.productTitle}</p>
                  <p><strong>Final Price:</strong> $${data.finalPrice}</p>
                  <p><strong>Approved Date:</strong> ${data.approvedDate}</p>

                  ${data.adminNotes ? `
                    <div style="margin-top: 20px; padding: 15px; background-color: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                      <p style="margin: 0; font-weight: 600; color: #155724; margin-bottom: 8px;">Admin Notes:</p>
                      <p style="margin: 0; color: #155724;">${data.adminNotes}</p>
                    </div>
                  ` : ''}
                </div>

                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <p style="margin: 0; color: #155724; font-size: 14px;">
                    <strong>What's Next?</strong> Your product is now visible to customers. You'll receive an email notification whenever someone purchases your item.
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  ${data.productId
                    ? `<a href="${data.siteUrl}/product/${data.productId}" class="button">View Your Product</a>`
                    : `<a href="${data.siteUrl}/my-products" class="button">View My Products</a>`
                  }
                </div>

                <p>Thank you for being a valued seller on Beckah Marketplace!</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'product_rejected':
      return {
        subject: `Product Submission Update - ${data.productTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Product Submission Update ℹ️</h1>
              </div>
              <div class="content">
                <h2>Update on your product submission</h2>
                <p>Hi ${data.sellerName},</p>
                <p>Thank you for submitting your product. After careful review, we're unable to approve it at this time.</p>

                <div class="order-details">
                  <h3>Submission Details</h3>
                  <p><strong>Product Title:</strong> ${data.productTitle}</p>
                  <p><strong>Submission Date:</strong> ${data.submittedDate}</p>
                  <p><strong>Review Date:</strong> ${data.reviewedDate}</p>

                  ${data.rejectionReason ? `
                    <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                      <p style="margin: 0; font-weight: 600; color: #856404; margin-bottom: 8px;">Reason for Update:</p>
                      <p style="margin: 0; color: #856404;">${data.rejectionReason}</p>
                    </div>
                  ` : ''}
                </div>

                <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <p style="margin: 0; color: #004085; font-size: 14px;">
                    <strong>What can you do?</strong> You can resubmit your product with the necessary changes. Please review our product guidelines and make sure your listing meets all requirements.
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/submit-product" class="button">Submit Another Product</a>
                </div>

                <p>If you have any questions about this decision, please don't hesitate to contact our support team.</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'new_order_to_seller':
      return {
        subject: `New Order for Your Product - #${data.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Order Received! 🎉</h1>
              </div>
              <div class="content">
                <h2>Great news! Someone purchased your product!</h2>
                <p>Hi ${data.sellerName},</p>
                <p>You have a new order for your product. Please prepare it for shipping as soon as possible.</p>

                <div class="order-details">
                  <h3>Order Details</h3>
                  <p><strong>Order ID:</strong> #${data.orderId}</p>
                  <p><strong>Order Date:</strong> ${data.orderDate}</p>
                  <p><strong>Customer:</strong> ${data.customerName}</p>

                  <h3 style="margin-top: 20px;">Product Sold:</h3>
                  <div class="product-item">
                    <img src="${data.productImage}" alt="${data.productTitle}" class="product-image" onerror="this.src='https://via.placeholder.com/80'">
                    <div style="flex: 1;">
                      <div><strong>${data.productTitle}</strong></div>
                      <div style="color: #6c757d;">Quantity: ${data.quantity}</div>
                      <div style="color: #667eea; font-weight: 600;">$${data.price}</div>
                    </div>
                  </div>

                  <div class="total">
                    Your Earnings: $${data.sellerEarnings}
                  </div>

                  <h3 style="margin-top: 20px;">Shipping Address:</h3>
                  <p>${data.shippingAddress}</p>
                </div>

                <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <p style="margin: 0; color: #856404; font-size: 14px;">
                    <strong>Action Required:</strong> Please process this order within 2-3 business days. Update the order status once it's shipped.
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${data.siteUrl}/seller-orders" class="button">Manage Order</a>
                </div>

                <p>Thank you for being a valued seller on Beckah Marketplace!</p>
              </div>
              <div class="footer">
                <p><strong>Beckah Marketplace</strong></p>
                <div class="unsubscribe">
                  <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

    default:
      return {
        subject: 'Notification from Beckah Marketplace',
        html: '<p>You have a new notification.</p>'
      };
  }
};
