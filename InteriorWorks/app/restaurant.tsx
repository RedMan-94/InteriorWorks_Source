'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Minus, Plus, Search, ShoppingBag, Star, Trash2, UtensilsCrossed, X } from 'lucide-react';

type MenuItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  badge?: string;
};

const menu: MenuItem[] = [
  { id: 1, name: 'Truffle Mushroom Pasta', description: 'Fresh linguine, wild mushrooms, parmesan & black truffle', price: 18.5, category: 'Mains', badge: 'Chef’s pick', image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85' },
  { id: 2, name: 'Garden Herb Pesto Bowl', description: 'Basil pesto, baby greens, cherry tomatoes & roasted potato', price: 14, category: 'Bowls', badge: 'Vegetarian', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85' },
  { id: 3, name: 'Fire-Grilled Salmon', description: 'Citrus glaze, charred broccolini and creamy mash', price: 24, category: 'Mains', image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=85' },
  { id: 4, name: 'Classic Margherita', description: 'San Marzano tomato, buffalo mozzarella & fresh basil', price: 16, category: 'Pizza', image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85' },
  { id: 5, name: 'Buttermilk Fried Chicken', description: 'Hot honey, pickles, slaw and house fries', price: 19.5, category: 'Mains', badge: 'Popular', image: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=85' },
  { id: 6, name: 'Spicy Tuna Crispy Rice', description: 'Sushi-grade tuna, jalapeño, sesame and ponzu', price: 17, category: 'Starters', badge: 'Spicy', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85' },
  { id: 7, name: 'Charred Corn Ribs', description: 'Smoked butter, lime, parmesan and tajín', price: 11, category: 'Starters', image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=85' },
  { id: 8, name: 'Salted Caramel Sundae', description: 'Vanilla bean, caramel, cookie crumb & whipped cream', price: 9, category: 'Desserts', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=85' },
];

const categories = ['Popular', 'Starters', 'Mains', 'Pizza', 'Bowls', 'Desserts'];

export default function Restaurant() {
  const [category, setCategory] = useState('Popular');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const shown = useMemo(() => menu.filter((item) => {
    const inCategory = category === 'Popular' || item.category === category;
    const inSearch = `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase());
    return inCategory && inSearch;
  }), [category, search]);

  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const subtotal = menu.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0);
  const delivery = subtotal > 0 ? 3.5 : 0;

  const updateQty = (id: number, delta: number) => {
    setCart((current) => {
      const nextQty = Math.max(0, (current[id] || 0) + delta);
      const next = { ...current };
      if (nextQty === 0) delete next[id]; else next[id] = nextQty;
      return next;
    });
  };

  const completeOrder = () => {
    setOrdered(true);
    setCart({});
  };

  return (
    <main className="restaurant-page">
      <header className="restaurant-header">
        <a className="restaurant-brand" href="#" aria-label="Sage & Salt home">
          <span className="brand-mark"><UtensilsCrossed size={19} /></span>
          <span>SAGE &amp; SALT</span>
        </a>
        <nav className="restaurant-nav" aria-label="Main navigation">
          <a className="active" href="#menu">Menu</a>
          <a href="#story">Our story</a>
          <a href="#visit">Visit</a>
        </nav>
        <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${count} items`}>
          <ShoppingBag size={18} />
          <span>Cart</span>
          {count > 0 && <b>{count}</b>}
        </button>
      </header>

      <section className="restaurant-hero" id="menu">
        <div className="hero-copy">
          <p className="restaurant-eyebrow">Season-led · Locally sourced</p>
          <h1>Good food,<br /><em>well shared.</em></h1>
          <p className="hero-description">Bright, unfussy dishes made for slow lunches and lively evenings.</p>
          <div className="hero-meta">
            <span><Star size={14} fill="currentColor" /> 4.9 <small>(320 reviews)</small></span>
            <i />
            <span>20–30 min</span>
          </div>
        </div>
        <div className="hero-photo" role="img" aria-label="Restaurant dish with fresh vegetables">
          <div className="open-pill"><span /> Open until 10:30 PM</div>
        </div>
      </section>

      <section className="menu-section">
        <div className="menu-heading">
          <div>
            <p className="restaurant-eyebrow">From our kitchen</p>
            <h2>Today’s menu</h2>
          </div>
          <label className="menu-search">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes" />
          </label>
        </div>

        <div className="category-row" aria-label="Menu categories">
          {categories.map((item) => (
            <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="menu-grid">
          {shown.map((item) => (
            <article className="menu-card" key={item.id}>
              <div className="dish-photo">
                <img src={item.image} alt={item.name} />
                {item.badge && <span className="dish-badge">{item.badge}</span>}
              </div>
              <div className="dish-info">
                <div className="dish-title"><h3>{item.name}</h3><strong>${item.price.toFixed(2)}</strong></div>
                <p>{item.description}</p>
                {cart[item.id] ? (
                  <div className="dish-quantity">
                    <button onClick={() => updateQty(item.id, -1)} aria-label={`Remove one ${item.name}`}><Minus size={15} /></button>
                    <span>{cart[item.id]}</span>
                    <button onClick={() => updateQty(item.id, 1)} aria-label={`Add one ${item.name}`}><Plus size={15} /></button>
                  </div>
                ) : (
                  <button className="add-button" onClick={() => updateQty(item.id, 1)}>Add to order <Plus size={15} /></button>
                )}
              </div>
            </article>
          ))}
        </div>
        {shown.length === 0 && <div className="no-dishes">No dishes match your search.</div>}
      </section>

      {cartOpen && (
        <div className="cart-overlay" onMouseDown={(e) => e.target === e.currentTarget && setCartOpen(false)}>
          <aside className="cart-drawer">
            {ordered ? (
              <div className="order-success">
                <div className="success-icon"><Check size={28} /></div>
                <p className="restaurant-eyebrow">Order confirmed</p>
                <h2>Thank you!</h2>
                <p>Your kitchen is preparing your order. We’ll have it ready in 25–30 minutes.</p>
                <button className="checkout-button" onClick={() => { setOrdered(false); setCheckout(false); setCartOpen(false); }}>Back to menu</button>
              </div>
            ) : checkout ? (
              <>
                <div className="cart-head"><button className="back-button" onClick={() => setCheckout(false)}><ArrowLeft size={17} /> Back</button><button className="close-button" onClick={() => setCartOpen(false)}><X size={20} /></button></div>
                <div className="checkout-form">
                  <p className="restaurant-eyebrow">Secure checkout</p><h2>Delivery details</h2>
                  <label>Full name<input placeholder="Alex Morgan" /></label>
                  <label>Delivery address<input placeholder="123 Garden Street" /></label>
                  <div className="form-row"><label>Phone<input placeholder="(555) 000-0000" /></label><label>ZIP<input placeholder="10001" /></label></div>
                  <label>Card number<input placeholder="4242 4242 4242 4242" /></label>
                  <button className="checkout-button" onClick={completeOrder}>Place order · ${(subtotal + delivery).toFixed(2)}</button>
                </div>
              </>
            ) : (
              <>
                <div className="cart-head"><div><p className="restaurant-eyebrow">Your order</p><h2>Cart <span>{count}</span></h2></div><button className="close-button" onClick={() => setCartOpen(false)}><X size={20} /></button></div>
                <div className="cart-items">
                  {count === 0 ? (
                    <div className="empty-cart"><ShoppingBag size={28} /><h3>Your cart is empty</h3><p>Add something delicious to get started.</p></div>
                  ) : menu.filter((item) => cart[item.id]).map((item) => (
                    <div className="cart-item" key={item.id}>
                      <img src={item.image} alt="" />
                      <div><h3>{item.name}</h3><strong>${(item.price * cart[item.id]).toFixed(2)}</strong><div className="cart-item-controls"><button onClick={() => updateQty(item.id, -1)}><Minus size={13} /></button><span>{cart[item.id]}</span><button onClick={() => updateQty(item.id, 1)}><Plus size={13} /></button></div></div>
                      <button className="remove-button" onClick={() => updateQty(item.id, -cart[item.id])} aria-label={`Remove ${item.name}`}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                {count > 0 && <div className="cart-summary"><div><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div><div><span>Delivery</span><strong>${delivery.toFixed(2)}</strong></div><div className="total-row"><span>Total</span><strong>${(subtotal + delivery).toFixed(2)}</strong></div><button className="checkout-button" onClick={() => setCheckout(true)}>Continue to checkout <ChevronRight size={17} /></button></div>}
              </>
            )}
          </aside>
        </div>
      )}

      {count > 0 && !cartOpen && <button className="floating-cart" onClick={() => setCartOpen(true)}><span><ShoppingBag size={17} /> View cart · {count}</span><strong>${subtotal.toFixed(2)}</strong></button>}
    </main>
  );
}
