import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, ChevronLeft, CreditCard, Wallet, Trash2, Share2, CheckCircle2,
  Package, TrendingUp, Receipt, ShoppingCart, X, Smartphone, LogOut, TrendingDown, Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc,
  setDoc,
  writeBatch,
  getDoc,
  getDocs
} from 'firebase/firestore';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const DEFAULT_MENU = [
  { id: 1, name: "Carne", price: 10, cost: 0, category: "Espetos" },
  { id: 5, name: "Frango com Bacon", price: 10, cost: 0, category: "Espetos" },
  { id: 6, name: "Coração", price: 10, cost: 0, category: "Espetos" },
  { id: 7, name: "Linguiça", price: 8, cost: 0, category: "Espetos" },
  { id: 8, name: "Linguiça Apimentada", price: 8, cost: 0, category: "Espetos" },
  { id: 9, name: "Queijo Coalho", price: 9, cost: 0, category: "Espetos" },
  { id: 10, name: "Pão de Alho", price: 6, cost: 0, category: "Espetos" },
  { id: 201, name: "X-Burguer", price: 16, cost: 0, category: "Hambúrgueres" },
  { id: 202, name: "Duplo Burguer", price: 24.50, cost: 0, category: "Hambúrgueres" },
  { id: 203, name: "Triplo Burguer", price: 33, cost: 0, category: "Hambúrgueres" },
  { id: 100, name: "Refri (Lata 350ml)", price: 6, cost: 0, category: "Bebidas" },
  { id: 101, name: "Suco - Del Valle", price: 8, cost: 0, category: "Bebidas" },
  { id: 108, name: "Heineken Long Neck", price: 10, cost: 0, category: "Bebidas" },
  { id: 102, name: "Original", price: 6, cost: 0, category: "Bebidas" },
  { id: 104, name: "Skol", price: 4, cost: 0, category: "Bebidas" },
  { id: 105, name: "Gin (Copão 700ml)", price: 15, cost: 0, category: "Bebidas" },
  { id: 106, name: "Whisky (700 ml)", price: 25, cost: 0, category: "Bebidas" }
];

export default function AppFirebase() {
  const [activeOrders, setActiveOrders] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [fixedCosts, setFixedCosts] = useState([]);
  const [closings, setClosings] = useState([]);
  
  const [activeView, setActiveView] = useState('orders');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showMonthClosingModal, setShowMonthClosingModal] = useState(false);
  const [showMenuEditor, setShowMenuEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showFixedCostsModal, setShowFixedCostsModal] = useState(false);
  const [newFixedCost, setNewFixedCost] = useState({ name: '', value: '' });

  const [customerName, setCustomerName] = useState('');
  const [toast, setToast] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorLog, setErrorLog] = useState(null);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('hugo@point.com');
  const [loginPassword, setLoginPassword] = useState('hugao123');

  // AUTH OBSERVER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // FIRESTORE SYNC: Active Orders
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/active_orders`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveOrders(orders);
    }, (err) => {
      setErrorLog(`Erro Firestore (Orders): ${err.message}`);
    });
    return () => unsubscribe();
  }, [user]);

  // FIRESTORE SYNC: Sales History
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/sales`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSalesHistory(sales);
    }, (err) => {
      setErrorLog(`Erro Firestore (Sales): ${err.message}`);
    });
    return () => unsubscribe();
  }, [user]);

  // FIRESTORE SYNC: Menu
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, `users/${user.uid}/config`, 'menu'), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const currentMenu = docSnapshot.data().items || [];
        
        // MIGRAÇÃO AUTOMÁTICA: Atualiza preços e nomes se o menu ainda for o antigo (ex: Carne a 9), mantendo o "cost"
        const isOldMenu = currentMenu.some(i => i.name === 'Carne' && i.price === 9);
        
        if (isOldMenu) {
          console.log("Migrando para o novo cardápio...");
          const mergedMenu = DEFAULT_MENU.map(defItem => {
            const existingItem = currentMenu.find(i => i.id === defItem.id);
            return {
              ...defItem,
              cost: existingItem ? existingItem.cost : 0
            };
          });
          setDoc(docSnapshot.ref, { items: mergedMenu });
        } else {
          setMenu(currentMenu);
        }
      } else {
        setDoc(docSnapshot.ref, { items: DEFAULT_MENU });
      }
    });
    return () => unsubscribe();
  }, [user]);

  // FIRESTORE SYNC: Fixed Costs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/fixed_costs`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const costs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFixedCosts(costs);
    });
    return () => unsubscribe();
  }, [user]);

  // FIRESTORE SYNC: Monthly Closings
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/monthly_closings`), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClosings(docs);
    });
    return () => unsubscribe();
  }, [user]);

  // MIGRATION: Local to Firestore (Improved)
  useEffect(() => {
    if (!user) return;
    const migrate = async () => {
      const saved = localStorage.getItem('espetinho_active_orders');
      const localOrders = saved ? JSON.parse(saved) : [];
      if (localOrders.length === 0) return;

      for (const order of localOrders) {
        if (typeof order.id === 'number') {
          try {
            await addDoc(collection(db, `users/${user.uid}/active_orders`), {
              customer: order.customer,
              items: order.items,
              createdAt: order.createdAt || new Date().toISOString()
            });
          } catch (err) { console.error(err); }
        }
      }
      localStorage.removeItem('espetinho_active_orders');
    };
    migrate();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      showToast('Bem-vindo!');
    } catch (err) {
      setErrorLog(`Erro Login: ${err.message}`);
      showToast('Erro ao entrar. Verifique os dados.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const createNewOrder = async () => {
    if (!customerName.trim() || isProcessing) return;
    
    if (!user) {
      setErrorLog("Sessão expirada ou usuário não logado. Faça login novamente.");
      return;
    }

    setIsProcessing(true);
    try {
      const orderData = {
        customer: customerName.trim().toUpperCase(),
        items: {},
        createdAt: new Date().toISOString()
      };
      console.log("Tentando criar comanda no Firestore...");
      
      // Promessa com Timeout de 8 segundos
      const createPromise = addDoc(collection(db, `users/${user.uid}/active_orders`), orderData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Tempo esgotado: O servidor do Firebase não respondeu.")), 8000)
      );

      const docRef = await Promise.race([createPromise, timeoutPromise]);
      console.log("Comanda criada com ID:", docRef.id);
      
      setCustomerName('');
      setShowNewOrderModal(false);
      
      setTimeout(() => {
        openOrderDetails(docRef.id);
        showToast('Comanda Aberta!');
      }, 300);

    } catch (err) {
      console.error("Erro completo:", err);
      setErrorLog(`Erro ao abrir comanda: ${err.message} (Código: ${err.code})`);
      showToast('Erro ao criar comanda.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openOrderDetails = (id) => {
    setSelectedOrderId(id);
    setActiveView('menu');
  };

  const testFirestoreConnection = async () => {
    setIsProcessing(true);
    setErrorLog("Testando conexão com banco...");
    try {
      const testPromise = getDoc(doc(db, "test_connection", "ping"));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("O Banco de Dados (Firestore) não respondeu.")), 5000)
      );
      await Promise.race([testPromise, timeoutPromise]);
      setErrorLog("✅ CONEXÃO COM BANCO OK! O problema pode ser permissão de escrita.");
    } catch (err) {
      setErrorLog(`❌ FALHA NO BANCO: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateQty = async (itemId, change) => {
    if (!user || !selectedOrderId) return;
    const order = activeOrders.find(o => o.id === selectedOrderId);
    if (!order) return;

    const newItems = { ...order.items };
    newItems[itemId] = (newItems[itemId] || 0) + change;
    if (newItems[itemId] <= 0) delete newItems[itemId];

    try {
      await setDoc(doc(db, `users/${user.uid}/active_orders`, selectedOrderId), { ...order, items: newItems });
    } catch (err) { console.error(err); }
  };

  const cancelOrder = async () => {
    if (!selectedOrderId || !user || isProcessing) return;
    if (!window.confirm("Tem certeza que deseja EXCLUIR esta comanda? Esta ação não pode ser desfeita.")) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/active_orders`, selectedOrderId));
      setActiveView('orders');
      setSelectedOrderId(null);
      showToast('Comanda Excluída.');
    } catch (err) {
      setErrorLog(`Erro ao excluir: ${err.message}`);
      showToast('Erro ao excluir.');
    } finally {
      setIsProcessing(false);
    }
  };

  const finishOrder = async (method) => {
    const orderToFinish = activeOrders.find(o => o.id === selectedOrderId);
    if (!orderToFinish || !user || isProcessing) return;

    const totalAtClick = currentTotal; // Captura o valor exato no clique
    setIsProcessing(true);
    
    const isInternal = method === 'Consumo/Cortesia';
    const sale = {
      customer: orderToFinish.customer,
      total: isInternal ? 0 : totalAtClick,
      method,
      items: Object.entries(orderToFinish.items).map(([id, qty]) => {
        const item = menu.find(i => i.id == id);
        return {
          id, qty, name: item?.name || 'Item Removido',
          price: item?.price || 0, cost: item?.cost || 0
        };
      }),
      date: new Date().toISOString()
    };

    const batch = writeBatch(db);
    const saleRef = doc(collection(db, `users/${user.uid}/sales`));
    const orderRef = doc(db, `users/${user.uid}/active_orders`, selectedOrderId);

    try {
      console.log("Iniciando transação atômica...");
      batch.set(saleRef, sale);
      batch.delete(orderRef);
      
      await batch.commit();
      console.log("Transação concluída com sucesso.");
      
      setShowCheckoutModal(false);
      setActiveView('orders');
      setSelectedOrderId(null);
      showToast('Comanda Finalizada!');
    } catch (err) {
      console.error("Erro na transação:", err);
      setErrorLog(`Erro Crítico: ${err.message}. Verifique as permissões do Firebase (Delete).`);
      showToast('Erro ao finalizar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveMenu = async (newMenu) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/config`, 'menu'), { items: newMenu });
      showToast('Menu atualizado!');
    } catch (err) { showToast('Erro ao salvar menu.'); }
  };

  const addFixedCost = async () => {
    const val = parseFloat(String(newFixedCost.value).replace(',', '.'));
    if (!user || !newFixedCost.name || isNaN(val)) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/fixed_costs`), {
        name: newFixedCost.name, value: val, date: new Date().toISOString()
      });
      setNewFixedCost({ name: '', value: '' });
      setShowFixedCostsModal(false);
      showToast('Custo adicionado!');
    } catch (err) { showToast('Erro ao salvar.'); }
  };

  const deleteFixedCost = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/fixed_costs`, id));
      showToast('Removido.');
    } catch (err) { showToast('Erro.'); }
  };

  const handleCloseMonth = async () => {
    if (!user || isProcessing) return;
    
    const openSales = salesHistory.filter(sale => !sale.closed);
    if (openSales.length === 0) return alert("Não há vendas abertas para fechar.");

    setIsProcessing(true);
    try {
      const totalBruto = openSales.reduce((acc, sale) => acc + sale.total, 0);
      const totalCMV = openSales.reduce((acc, sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        return acc + items.reduce((c, i) => c + ((i.cost || 0) * i.qty), 0);
      }, 0);
      const totalFixos = fixedCosts.reduce((acc, c) => acc + c.value, 0);

      const closingData = {
        date: new Date().toISOString(),
        totalBruto,
        totalCMV,
        totalFixos,
        lucroLiquido: (totalBruto - totalCMV) - totalFixos,
        salesCount: openSales.length
      };

      const batch = writeBatch(db);
      
      // 1. Criar o registro de fechamento
      const closingRef = doc(collection(db, `users/${user.uid}/monthly_closings`));
      batch.set(closingRef, closingData);

      // 2. Marcar vendas como fechadas
      openSales.forEach(sale => {
        const saleRef = doc(db, `users/${user.uid}/sales`, sale.id);
        batch.update(saleRef, { closed: true, closingId: closingRef.id });
      });

      await batch.commit();
      
      setShowMonthClosingModal(false);
      showToast('Mês Fechado com Sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao fechar mês.');
    } finally {
      setIsProcessing(false);
    }
  };

  const calcOrderTotal = (order) => {
    if (!order || !order.items) return 0;
    return Object.entries(order.items).reduce((acc, [id, qty]) => {
      const item = menu.find(i => i.id == id);
      return acc + ((item?.price || 0) * (qty));
    }, 0);
  };

  const currentOrder = useMemo(() => activeOrders.find(o => o.id === selectedOrderId), [activeOrders, selectedOrderId]);
  const currentTotal = useMemo(() => {
    if (!currentOrder) return 0;
    return Object.entries(currentOrder.items).reduce((acc, [id, qty]) => {
      const item = menu.find(i => i.id == id);
      return acc + ((item?.price || 0) * (qty));
    }, 0);
  }, [currentOrder, menu]);

  const reportSummary = useMemo(() => {
    const today = new Date().toLocaleDateString();
    const todaySales = salesHistory.filter(sale => {
      const isToday = new Date(sale.date).toLocaleDateString() === today;
      return isToday && !sale.closed;
    });
    return todaySales.reduce((acc, sale) => {
      acc[sale.method] = (acc[sale.method] || 0) + sale.total;
      acc.total += sale.total;
      const itemsArray = Array.isArray(sale.items) ? sale.items : Object.entries(sale.items).map(([id, qty]) => ({ id, qty, cost: menu.find(i => i.id == id)?.cost || 0 }));
      itemsArray.forEach((item) => {
        acc.itemCounts[item.id] = (acc.itemCounts[item.id] || 0) + (item.qty);
        const currentItemMenu = menu.find(m => m.id == item.id);
        acc.totalCost += (currentItemMenu?.cost || item.cost || 0) * (item.qty);
      });
      return acc;
    }, { PIX: 0, Cartão: 0, Dinheiro: 0, total: 0, totalCost: 0, itemCounts: {}, salesCount: todaySales.length });
  }, [salesHistory, menu]);

  const exportReport = async () => {
    if (!reportSummary.salesCount) return alert("Sem dados.");
    const itemText = Object.entries(reportSummary.itemCounts).sort((a, b) => (b[1]) - (a[1])).map(([id, qty]) => {
      const item = menu.find(i => i.id == id);
      return `• ${qty}x ${item?.name || 'Item Removido'}`;
    }).join('\n');

    const message = encodeURIComponent(
      `📊 *RELATÓRIO POINT DO HUGÃO*\n` +
      `📅 Data: ${new Date().toLocaleDateString()}\n\n` +
      `💰 *VENDAS:* R$ ${reportSummary.total.toFixed(2)}\n` +
      `💳 PIX: R$ ${reportSummary.PIX.toFixed(2)}\n` +
      `💵 Dinheiro: R$ ${reportSummary.Dinheiro.toFixed(2)}\n` +
      `💳 Cartão: R$ ${reportSummary.Cartão.toFixed(2)}\n\n` +
      `🍗 *ITENS VENDIDOS:*\n${itemText}`
    );
    window.open(`https://wa.me/?text=${message}`);
    setShowCloseConfirmModal(false);
  };

  const downloadCSV = () => {
    const now = new Date();
    const today = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
    const fileName = `gestao_hugao_${today}.csv`;
    
    // Filtrar dados do período aberto para o resumo
    const openSales = salesHistory.filter(sale => !sale.closed);

    const totalBruto = openSales.reduce((acc, sale) => acc + sale.total, 0);
    const totalFixos = fixedCosts.reduce((acc, c) => acc + c.value, 0);
    
    // Agregação por Produto
    const productStats = {};
    openSales.forEach(sale => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach(item => {
        if (!productStats[item.name]) {
          productStats[item.name] = { qty: 0, revenue: 0, cost: 0 };
        }
        productStats[item.name].qty += item.qty;
        productStats[item.name].revenue += (item.price || 0) * item.qty;
        productStats[item.name].cost += (item.cost || 0) * item.qty;
      });
    });

    const totalCMV = Object.values(productStats).reduce((acc, p) => acc + p.cost, 0);
    const lucroLiquido = (totalBruto - totalCMV) - totalFixos;

    let csvContent = "\ufeff"; // BOM para acentos no Excel
    
    // SEÇÃO 1: RESUMO FINANCEIRO
    csvContent += `### RESUMO GERENCIAL - ${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()} ###\n`;
    csvContent += `Faturamento Bruto;R$ ${totalBruto.toFixed(2).replace('.', ',')}\n`;
    csvContent += `Custo de Mercadoria (CMV);R$ ${totalCMV.toFixed(2).replace('.', ',')}\n`;
    csvContent += `Despesas Fixas;R$ ${totalFixos.toFixed(2).replace('.', ',')}\n`;
    csvContent += `LUCRO LÍQUIDO ESTIMADO;R$ ${lucroLiquido.toFixed(2).replace('.', ',')}\n\n`;

    // SEÇÃO 2: RANKING DE PRODUTOS
    csvContent += `### PERFORMANCE POR PRODUTO ###\n`;
    csvContent += `Produto;Qtd Vendida;Faturamento;Custo Total;Margem de Lucro\n`;
    Object.entries(productStats)
      .sort((a, b) => b[1].qty - a[1].qty)
      .forEach(([name, stats]) => {
        const margem = stats.revenue - stats.cost;
        csvContent += `${name};${stats.qty};R$ ${stats.revenue.toFixed(2).replace('.', ',')};R$ ${stats.cost.toFixed(2).replace('.', ',')};R$ ${margem.toFixed(2).replace('.', ',')}\n`;
      });
    csvContent += `\n`;

    // SEÇÃO 3: DETALHAMENTO DE VENDAS
    csvContent += `### LOG DETALHADO DE VENDAS ###\n`;
    csvContent += `Data;Cliente;Metodo;Total;Itens\n`;
    openSales.forEach(sale => {
      const itemsText = (Array.isArray(sale.items) ? sale.items : []).map(i => `${i.qty}x ${i.name}`).join(' | ');
      csvContent += `${new Date(sale.date).toLocaleString()};${sale.customer};${sale.method};R$ ${sale.total.toFixed(2).replace('.', ',')};${itemsText}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    showToast('Relatório Gerencial Gerado!');
  };

  if (showOnboarding) {
    return (
      <div className="bg-[#020617] min-h-screen text-[#f8fafc] font-sans selection:bg-orange-500/30">
        <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-8 pb-20 relative">
          <button 
            onClick={() => setShowOnboarding(false)} 
            className="absolute top-4 right-4 p-3 bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          <header className="text-center pt-8 pb-4 border-b border-slate-800">
            <p className="text-orange-500 text-xs font-bold uppercase tracking-[0.3em] mb-4">Parceria Estratégica</p>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Point do <span class="text-yellow-400">Hugão</span></h1>
            <p className="text-slate-400 text-sm">Powered by Ottomatic</p>
          </header>

          <section className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">Hugo e Thayna, o jogo mudou.</h2>
            <p className="text-slate-400 leading-relaxed">
              Parabéns pelo próximo passo. Saímos de uma simples comanda digital para um <strong class="text-orange-400">Sistema de Gestão de Negócios</strong>. A missão da Ottomatic aqui é clara: dar agilidade extrema no fogo para o Hugo e controle financeiro absoluto para a Thayna.
            </p>
          </section>

          <section className="bg-emerald-950/30 border-2 border-emerald-500/50 rounded-2xl p-6 text-center">
            <p className="text-emerald-500 font-black uppercase text-xs tracking-widest mb-2">🚀 SISTEMA OFICIAL ATIVADO</p>
            <p className="text-sm text-slate-200 leading-relaxed">
              Hugo e Thayna, a partir de hoje este é o canal oficial de vendas. Todas as comandas e custos lançados aqui serão consolidados para o fechamento mensal no dia 10.
            </p>
          </section>

          <section className="bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 bg-orange-600 text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-widest">
              Transparência
            </div>
            <h3 className="text-lg font-black uppercase text-orange-500 mb-4 tracking-tight">1. O Acordo de Parceria</h3>
            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span>Taxa de Implementação / Setup:</span>
                <span class="font-black text-green-400 text-lg">R$ 0,00</span>
              </div>
              <p className="text-xs text-slate-500">
                O mercado cobra de R$ 800 a R$ 1.500 para estruturar, configurar servidores e adaptar um sistema. Este é o investimento inicial da Ottomatic no sucesso de vocês. Custo zero para começar.
              </p>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 pt-2">
                <span>Assinatura Mensal (Gestão Cloud):</span>
                <span class="font-black text-yellow-400 text-lg">R$ 90,00</span>
              </div>
              <p className="text-xs text-slate-500">
                Aplicativos de prateleira cobram mais de R$ 139/mês. Por R$ 90 mensais, vocês garantem o servidor no ar 24h, suporte técnico e um sistema feito sob medida.
              </p>
            </div>
          </section>

          <section className="bg-slate-900 rounded-2xl p-6 border-l-4 border-orange-500 border-t border-r border-b border-slate-800 text-left">
            <h3 className="text-lg font-black uppercase text-slate-200 mb-2">2. Operação no Balcão <span class="text-orange-500">(Hugo)</span></h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">🔥 <strong>Lançamento:</strong> Clique no (+), nome e toque nos espetos.</li>
              <li className="flex gap-3">🔥 <strong>Fechar:</strong> Escolha PIX, Cartão ou Dinheiro e finalize.</li>
              <li className="flex gap-3">☕ <strong>Consumo Próprio:</strong> Use o botão "Consumo/Cortesia" para abater do estoque sem sujar o caixa.</li>
              <li className="flex gap-3">📲 <strong>Fechar o Dia:</strong> Gere o resumo e envie para o WhatsApp da Thayna.</li>
            </ul>
          </section>

          <section className="bg-slate-900 rounded-2xl p-6 border-l-4 border-yellow-500 border-t border-r border-b border-slate-800 text-left">
            <h3 className="text-lg font-black uppercase text-slate-200 mb-2">3. O Cérebro Financeiro <span class="text-yellow-500">(Thayna)</span></h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">💰 <strong>Controle Absoluto:</strong> Saiba exatamente o que foi vendido pelo WhatsApp.</li>
              <li className="flex gap-3">📉 <strong>Margens Reais:</strong> Veja o lucro líquido já descontando carne e despesas fixas.</li>
              <li className="flex gap-3">📅 <strong>Visão Mensal:</strong> O painel foca no resultado do mês atual.</li>
            </ul>
          </section>

          <section className="text-center bg-orange-900/20 p-6 rounded-2xl border border-orange-500/30">
            <h3 className="text-sm font-black uppercase text-orange-400 tracking-widest mb-2">FOCO NO LUCRO</h3>
            <p className="text-sm text-slate-300 mb-4">
              O objetivo agora é manter a operação ágil e os custos sob controle total.
            </p>
            <div className="bg-orange-900/40 p-4 rounded-xl border border-orange-500/50 mb-5 text-left">
              <p className="text-sm font-black text-orange-400 mb-1">⚠️ TAREFA OBRIGATÓRIA</p>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                Acessem e preencham o Custo e Valor de cada produto. Sem isso, o lucro não aparece!
              </p>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">DIA 01/05 O SISTEMA PASSA A SER O OFICIAL.</p>
          </section>

          {/* BLOCO DE INSTALAÇÃO */}
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
            <p className="text-orange-400 text-xs font-black uppercase tracking-widest mb-3">📱 INSTALAÇÃO E USO MULTITELA</p>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              <strong>Cada um pode usar no seu próprio celular ou computador!</strong>
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Para a melhor experiência: acesse o sistema no navegador, clique nos <strong>3 pontinhos</strong> no canto e escolha a opção <strong>"Adicionar à tela inicial"</strong> (ou Instalar).
            </p>
          </div>

          <button 
            onClick={() => setShowOnboarding(false)} 
            className="w-full text-center py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-xl shadow-xl shadow-orange-900/40 active:scale-95 transition-all uppercase tracking-tighter"
          >
            ACESSAR SISTEMA
          </button>
        </div>
      </div>
    );
  }

  if (authLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 text-slate-50 overflow-hidden">

      {!user ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-slate-900 to-slate-950">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-orange-500 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20 mb-6">
                <Package size={40} className="text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2">ACESSO RESTRITO</h2>
              <p className="text-slate-500 font-medium">Point do Hugão - Gestão Cloud</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">E-mail de Acesso</label>
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Senha</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-orange-500 transition-colors" />
              </div>
              <button type="submit" disabled={isProcessing} className="w-full py-5 bg-orange-500 rounded-2xl font-black text-white shadow-xl shadow-orange-500/10 active:scale-95 transition-transform">
                ENTRAR NO SISTEMA
              </button>
              <button 
                type="button"
                onClick={() => { localStorage.clear(); window.location.reload(); }}
                className="w-full py-3 text-slate-600 text-[10px] font-bold uppercase tracking-widest"
              >
                Limpar Cache e Reiniciar
              </button>
            </form>
          </motion.div>
        </div>
      ) : (
        <>
          <header className="px-5 py-4 flex justify-between items-center border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-white via-orange-400 to-yellow-500 bg-clip-text text-transparent">
                POINT DO HUGÃO
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <p className="text-[9px] font-black text-orange-500/90 uppercase tracking-[0.2em] animate-pulse">
                  Ottomatic Brasa On
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:bg-white/10 transition-colors"><LogOut size={18} /></button>
          </header>

          <main className="flex-1 overflow-y-auto p-5 pb-32">
            <AnimatePresence mode="wait">
              {activeView === 'orders' && (
                <motion.div key="orders" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h2 className="text-2xl font-black text-white">Comandas</h2>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{activeOrders.length} mesas abertas</p>
                    </div>
                    <button onClick={() => setShowNewOrderModal(true)} className="p-4 bg-orange-500 rounded-[1.5rem] shadow-lg shadow-orange-500/20 active:scale-90 transition-transform"><Plus className="text-white" size={24} /></button>
                  </div>
                  <div className="grid gap-3">
                    {activeOrders.map((order) => (
                      <button key={order.id} onClick={() => openOrderDetails(order.id)} className="p-6 rounded-[2rem] bg-slate-900/40 border border-white/5 flex justify-between items-center group active:bg-slate-900 transition-colors">
                        <div className="text-left">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          <p className="text-lg font-bold text-slate-200 group-active:text-white">{order.customer}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-white">R$ {calcOrderTotal(order).toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-orange-500 uppercase">Ver Itens</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeView === 'menu' && (
                <motion.div key="menu" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 pb-60">
                  {!currentOrder ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-slate-500 font-bold animate-pulse">SINCRONIZANDO COMANDA...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <button onClick={() => setActiveView('orders')} className="p-3 bg-white/5 rounded-2xl text-slate-400"><ChevronLeft /></button>
                          <div>
                            <h2 className="text-xl font-black text-white leading-none uppercase">{currentOrder.customer}</h2>
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-1">Editando Comanda</p>
                          </div>
                        </div>
                        <button 
                          onClick={cancelOrder}
                          className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 active:bg-red-500 active:text-white transition-all"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                      {[...new Set(menu.map(i => i.category))].map(cat => (
                        <section key={cat} className="space-y-3">
                          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">{cat}</h3>
                          <div className="grid gap-2">
                            {menu.filter(i => i.category === cat).map(item => (
                              <div key={item.id} className="p-4 rounded-3xl bg-slate-900/50 border border-white/5 flex justify-between items-center">
                                <div className="flex-1" onClick={() => updateQty(item.id, 1)}>
                                  <p className="font-bold text-slate-200">{item.name}</p>
                                  <p className="text-sm font-black text-orange-500">R$ {item.price.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-950 p-2 rounded-2xl border border-white/5">
                                  <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-xl text-slate-400">-</button>
                                  <span className="font-bold text-white min-w-[20px] text-center">{currentOrder?.items[item.id] || 0}</span>
                                  <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-orange-500 rounded-xl text-white">+</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </>
                  )}
                </motion.div>
              )}

              {activeView === 'admin' && (
                <motion.div key="admin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  <h2 className="text-2xl font-black text-white">Gestão Point</h2>
                  <div className="p-6 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5">
                    <h3 className="text-lg font-bold mb-4 capitalize">
                      Fechamento {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h3>
                    {(() => {
                      const openSales = salesHistory.filter(sale => !sale.closed);
                      
                      const totalBruto = openSales.reduce((acc, sale) => acc + sale.total, 0);
                      const margemBruta = openSales.reduce((acc, sale) => {
                        const items = Array.isArray(sale.items) ? sale.items : [];
                        const cost = items.reduce((c, i) => {
                          const currentItemMenu = menu.find(m => m.id == i.id);
                          return c + ((currentItemMenu?.cost || i.cost || 0) * i.qty);
                        }, 0);
                        return acc + (sale.total - cost);
                      }, 0);
                      
                      const totalFixos = fixedCosts.reduce((acc, c) => acc + c.value, 0);

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 rounded-2xl bg-white/5">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Bruto</p>
                              <p className="text-xl font-black text-white">R$ {totalBruto.toFixed(2)}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Margem Bruta</p>
                              <p className="text-xl font-black text-emerald-400">R$ {margemBruta.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-6 text-center">
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Lucro Líquido Estimado</p>
                            <p className="text-3xl font-black text-white">R$ {(margemBruta - totalFixos).toFixed(2)}</p>
                          </div>
                        </>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button onClick={() => setShowMenuEditor(true)} className="py-4 bg-slate-900 border border-white/10 rounded-2xl font-bold text-xs flex flex-col items-center gap-2"><Package size={18} className="text-orange-500" />PREÇOS/CUSTOS</button>
                      <button onClick={() => setShowFixedCostsModal(true)} className="py-4 bg-slate-900 border border-white/10 rounded-2xl font-bold text-xs flex flex-col items-center gap-2"><Wallet size={18} className="text-cyan-500" />DESPESAS FIXAS</button>
                    </div>
                    <button onClick={downloadCSV} className="w-full py-4 bg-emerald-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-transform mb-3"><Receipt size={18} />BAIXAR RELATÓRIO (EXCEL)</button>
                    <button onClick={() => setShowMonthClosingModal(true)} className="w-full py-4 bg-orange-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 active:scale-95 transition-transform mb-6"><CheckCircle2 size={18} />ENCERRAR PERÍODO / MÊS</button>
                    
                    <button onClick={() => setShowOnboarding(true)} className="w-full py-3 bg-slate-900 border border-white/5 rounded-xl text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-slate-300 transition-colors">Ver Manual e Regras do Sistema</button>
                  </div>

                  {closings.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Histórico de Fechamentos</h3>
                      <div className="grid gap-3">
                        {closings.map(closing => (
                          <div key={closing.id} className="p-5 rounded-3xl bg-slate-900/30 border border-white/5 flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(closing.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                              <p className="text-sm font-bold text-slate-300">{new Date(closing.date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-emerald-400">Lucro: R$ {closing.lucroLiquido.toFixed(2)}</p>
                              <p className="text-[8px] font-bold text-slate-600 uppercase">{closing.salesCount} vendas</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeView === 'report' && (
                <motion.div key="report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  <h2 className="text-2xl font-black text-white">Relatório Hoje</h2>
                  <div className="p-8 rounded-[2.5rem] bg-slate-900/50 border border-white/5 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Total do Dia</p>
                    <h3 className="text-5xl font-black text-white mb-8">R$ {reportSummary.total.toFixed(2)}</h3>
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="space-y-1"><p className="text-[8px] font-bold text-slate-500 uppercase">PIX</p><p className="font-bold text-cyan-400">R${reportSummary.PIX}</p></div>
                      <div className="space-y-1"><p className="text-[8px] font-bold text-slate-500 uppercase">Dinh.</p><p className="font-bold text-emerald-400">R${reportSummary.Dinheiro}</p></div>
                      <div className="space-y-1"><p className="text-[8px] font-bold text-slate-500 uppercase">Cart.</p><p className="font-bold text-purple-400">R${reportSummary.Cartão}</p></div>
                    </div>
                    <button onClick={() => setShowCloseConfirmModal(true)} className="w-full py-5 bg-white text-slate-950 rounded-3xl font-black text-lg active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-xl shadow-white/5"><Share2 size={20} />FECHAR DIA (ZAP)</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <nav className="fixed bottom-0 left-0 right-0 p-5 bg-slate-950/80 backdrop-blur-2xl border-t border-white/5 z-40 max-w-md mx-auto">
            <div className="flex justify-around items-center bg-slate-900/80 rounded-full p-2 border border-white/10 shadow-2xl">
              {[
                { id: 'orders', icon: ShoppingCart, label: 'Comandas' },
                { id: 'admin', icon: TrendingUp, label: 'Gestão' },
                { id: 'report', icon: Receipt, label: 'Resumo' }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveView(tab.id)} className={cn("flex flex-col items-center gap-1 px-6 py-3 rounded-full transition-all", activeView === tab.id ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-slate-300")}>
                  <tab.icon size={20} />
                  <span className="text-[8px] font-bold uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {activeView === 'menu' && (
            <div className="fixed bottom-28 left-0 right-0 px-5 max-w-md mx-auto pointer-events-none">
              <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex justify-between items-center pointer-events-auto">
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Parcial</p><p className="text-2xl font-black text-white">R$ {currentTotal.toFixed(2)}</p></div>
                <button onClick={() => setShowCheckoutModal(true)} disabled={currentTotal === 0} className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm active:scale-95 transition-transform disabled:opacity-50">FINALIZAR</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {showNewOrderModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-white/10 p-8">
              <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-bold">Nova Comanda</h3><button onClick={() => setShowNewOrderModal(false)}><X /></button></div>
              <div className="relative mb-8"><input type="text" autoFocus value={customerName} onChange={(e) => setCustomerName(e.target.value.toUpperCase())} placeholder="EX: JULIO" className="w-full bg-slate-950 border border-white/5 rounded-3xl p-6 text-xl font-bold focus:border-orange-500 outline-none" /><Smartphone className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-800" /></div>
              <button onClick={createNewOrder} disabled={isProcessing} className={cn("w-full py-5 rounded-3xl font-black text-lg transition-all", isProcessing ? "bg-slate-800 text-slate-500" : "bg-orange-500 text-white shadow-xl shadow-orange-500/10")}>{isProcessing ? 'ABRINDO...' : 'ABRIR COMANDA'}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCheckoutModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-xs bg-slate-900 rounded-[3rem] border border-white/10 p-8 text-center">
              <div className="mb-8"><p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Total a Pagar</p><h3 className="text-4xl font-black text-white">R$ {currentTotal.toFixed(2)}</h3></div>
              <div className="grid gap-3 mb-8">
                {['PIX', 'Cartão', 'Dinheiro', 'Consumo/Cortesia'].map(m => (
                  <button 
                    key={m} 
                    onClick={() => finishOrder(m)} 
                    disabled={isProcessing}
                    className={cn(
                      "py-4 px-6 bg-slate-950 border border-white/5 rounded-[2rem] flex items-center justify-between hover:border-orange-500/50 transition-all active:scale-95",
                      isProcessing && "opacity-50",
                      m === 'Consumo/Cortesia' && "border-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center", 
                        m==='PIX'?'bg-cyan-500/10 text-cyan-400':
                        m==='Cartão'?'bg-purple-500/10 text-purple-400':
                        m==='Dinheiro'?'bg-emerald-500/10 text-emerald-400':
                        'bg-slate-500/10 text-slate-400'
                      )}>
                        {m==='PIX'?<TrendingUp size={18}/>:
                         m==='Cartão'?<CreditCard size={18}/>:
                         m==='Dinheiro'?<Wallet size={18}/>:
                         <Coffee size={18}/>}
                      </div>
                      <span className={cn("font-bold uppercase text-[10px]", m === 'Consumo/Cortesia' ? "text-slate-500" : "text-white")}>
                        {isProcessing ? '...' : m}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-500 font-bold text-xs uppercase">Cancelar</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMenuEditor && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex flex-col">
            <header className="p-6 flex justify-between items-center border-b border-white/5"><h3 className="text-xl font-bold">Gerenciar Produtos</h3><button onClick={() => setShowMenuEditor(false)}><X /></button></header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {menu.map(item => (
                <div key={item.id} className="p-4 rounded-3xl bg-slate-900 border border-white/5 flex justify-between items-center">
                  <div><p className="font-bold">{item.name}</p><div className="flex gap-4 mt-1"><p className="text-[10px] text-emerald-400 uppercase font-bold">Venda: R${item.price.toFixed(2)}</p><p className="text-[10px] text-red-400 uppercase font-bold">Custo: R${item.cost.toFixed(2)}</p></div></div>
                  <button onClick={() => setEditingItem(item)} className="p-3 bg-white/5 rounded-2xl text-orange-500 font-bold text-xs uppercase">Editar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-white/10 p-8">
              <h3 className="text-xl font-bold mb-6 text-center">{editingItem.name}</h3>
              <div className="space-y-4 mb-8">
                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Preço (R$)</label><input type="text" inputMode="decimal" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 font-bold" /></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Custo (R$)</label><input type="text" inputMode="decimal" value={editingItem.cost} onChange={e => setEditingItem({...editingItem, cost: e.target.value})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 font-bold" /></div>
                
                {/* INDICADOR DE MARGEM E LUCRO */}
                {parseFloat(String(editingItem.price).replace(',', '.')) > 0 && (() => {
                  const p = parseFloat(String(editingItem.price).replace(',', '.')) || 0;
                  const c = parseFloat(String(editingItem.cost).replace(',', '.')) || 0;
                  return (
                    <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Lucro Unitário</p>
                        <p className="text-xl font-black text-white">R$ {(p - c).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Margem</p>
                        <p className="text-xl font-black text-white">
                          {p > 0 ? (((p - c) / p) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="grid gap-3">
                <button onClick={() => { 
                  const p = parseFloat(String(editingItem.price).replace(',', '.')) || 0;
                  const c = parseFloat(String(editingItem.cost).replace(',', '.')) || 0;
                  const itemToSave = { ...editingItem, price: p, cost: c };
                  const nm = menu.map(i => i.id === editingItem.id ? itemToSave : i); 
                  saveMenu(nm); 
                  setEditingItem(null); 
                }} className="py-4 bg-orange-500 rounded-2xl font-black">SALVAR</button>
                <button onClick={() => setEditingItem(null)} className="py-4 text-slate-500 font-bold uppercase text-xs">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCloseConfirmModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-xs bg-slate-900 rounded-[2.5rem] border border-white/10 p-8 text-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500"><Share2 size={32} /></div>
              <h3 className="text-xl font-bold mb-2">Enviar p/ WhatsApp?</h3>
              <p className="text-slate-500 text-sm mb-8">O relatório de hoje será formatado e enviado para o seu WhatsApp.</p>
              <div className="grid gap-3">
                <button onClick={exportReport} className="py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-500/20">CONFIRMAR E ENVIAR</button>
                <button onClick={() => setShowCloseConfirmModal(false)} className="py-4 text-slate-500 font-bold uppercase text-xs">Agora não</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMonthClosingModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-white/10 p-8">
              <h3 className="text-xl font-bold mb-6 text-center">Confirmar Fechamento?</h3>
              
              {(() => {
                const openSales = salesHistory.filter(sale => !sale.closed);
                const totalBruto = openSales.reduce((acc, sale) => acc + sale.total, 0);
                const totalFixos = fixedCosts.reduce((acc, c) => acc + c.value, 0);
                const margemBruta = openSales.reduce((acc, sale) => {
                  const items = Array.isArray(sale.items) ? sale.items : [];
                  const cost = items.reduce((c, i) => c + ((i.cost || 0) * i.qty), 0);
                  return acc + (sale.total - cost);
                }, 0);
                const lucro = margemBruta - totalFixos;

                return (
                  <div className="space-y-4 mb-8">
                    <div className="p-4 rounded-2xl bg-white/5 space-y-2">
                      <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">FATURAMENTO:</span><span className="text-white">R$ {totalBruto.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">DESPESAS FIXAS:</span><span className="text-red-400">- R$ {totalFixos.toFixed(2)}</span></div>
                      <div className="border-t border-white/5 pt-2 flex justify-between text-sm font-black"><span className="text-orange-500 uppercase">LUCRO LÍQUIDO:</span><span className="text-emerald-400">R$ {lucro.toFixed(2)}</span></div>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center leading-relaxed italic">
                      Ao confirmar, todas as {openSales.length} vendas atuais serão arquivadas e o saldo será reiniciado.
                    </p>
                  </div>
                );
              })()}

              <div className="grid gap-3">
                <button 
                  onClick={handleCloseMonth} 
                  disabled={isProcessing}
                  className="py-5 bg-orange-600 text-white rounded-3xl font-black shadow-xl shadow-orange-900/20 active:scale-95 transition-all"
                >
                  {isProcessing ? 'FECHANDO...' : 'FECHAR MÊS AGORA'}
                </button>
                <button onClick={() => setShowMonthClosingModal(false)} className="py-4 text-slate-500 font-bold uppercase text-xs">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFixedCostsModal && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex flex-col">
            <header className="p-6 flex justify-between items-center border-b border-white/5"><h3 className="text-xl font-bold">Despesas Fixas</h3><button onClick={() => setShowFixedCostsModal(false)}><X /></button></header>
            <div className="p-6">
              <div className="bg-slate-900 rounded-3xl p-4 border border-white/5 space-y-3 mb-6">
                <input placeholder="Nome (Ex: Aluguel)" value={newFixedCost.name} onChange={e => setNewFixedCost({...newFixedCost, name: e.target.value})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-sm" />
                <input type="text" inputMode="decimal" placeholder="Valor (R$)" value={newFixedCost.value} onChange={e => setNewFixedCost({...newFixedCost, value: e.target.value})} className="w-full bg-slate-950 border border-white/5 rounded-2xl p-3 text-sm" />
                <button onClick={addFixedCost} className="w-full py-3 bg-cyan-600 rounded-2xl font-black text-xs uppercase">Adicionar</button>
              </div>
              <div className="space-y-2">
                {fixedCosts.map(cost => (
                  <div key={cost.id} className="p-4 rounded-2xl bg-white/5 flex justify-between items-center">
                    <div><p className="font-bold text-sm">{cost.name}</p><p className="text-xs text-slate-500 font-bold">R$ {cost.value.toFixed(2)}</p></div>
                    <button onClick={() => deleteFixedCost(cost.id)} className="text-red-500 p-2"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white text-slate-950 rounded-full font-black shadow-2xl z-[300] flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-xs uppercase tracking-widest">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
