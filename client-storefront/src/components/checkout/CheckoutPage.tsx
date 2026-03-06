import { CheckCircle } from 'lucide-react';

export function CheckoutPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <CheckCircle className="h-16 w-16 mx-auto mb-6" style={{ color: 'var(--color-primary)' }} />
      <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
      <p className="text-gray-600 text-lg mb-8">
        Thank you for your purchase. You'll receive a confirmation email shortly with your order details.
      </p>
      <a href="/" className="btn-primary">
        Continue Shopping
      </a>
    </div>
  );
}
