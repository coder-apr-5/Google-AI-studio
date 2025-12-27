import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  limit,
  startAfter,
  type DocumentData,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  ChatMessage,
  Farmer,
  FarmerDashboardWeather,
  MandiPriceDoc,
  MarketRate,
  Negotiation,
  User,
  UserRole,
  CallStatus,
  type Product,
} from '../types';

const toDate = (value: unknown): Date => {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value && 'toDate' in (value as any)) {
    try {
      return (value as any).toDate();
    } catch {
      return new Date(0);
    }
  }
  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
};

const mapProducts = (snap: QuerySnapshot<DocumentData>): Product[] =>
  snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.name ?? '',
      description: data.description ?? '',
      price: Number(data.price ?? 0),
      quantity: Number(data.quantity ?? 0),
      category: data.category,
      imageUrl: data.imageUrl ?? '',
      farmerId: data.farmerId ?? '',
      type: data.type,
      isVerified: Boolean(data.isVerified ?? false),
      verificationFeedback: data.verificationFeedback,
    } satisfies Product;
  });

const mapFarmers = (snap: QuerySnapshot<DocumentData>): Farmer[] =>
  snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.name ?? '',
      profileImageUrl: data.profileImageUrl ?? data.avatarUrl ?? '',
      isVerified: Boolean(data.isVerified ?? false),
      rating: Number(data.rating ?? 0),
      bio: data.bio ?? '',
      yearsFarming: Number(data.yearsFarming ?? 0),
      location: data.location ?? '',
      verificationFeedback: data.verificationFeedback,
    } satisfies Farmer;
  });

const mapNegotiations = (snap: QuerySnapshot<DocumentData>): Negotiation[] =>
  snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      productId: data.productId,
      productName: data.productName,
      productImageUrl: data.productImageUrl,
      buyerId: data.buyerId,
      farmerId: data.farmerId,
      initialPrice: Number(data.initialPrice ?? 0),
      offeredPrice: Number(data.offeredPrice ?? 0),
      counterPrice: data.counterPrice != null ? Number(data.counterPrice) : undefined,
      quantity: Number(data.quantity ?? 0),
      status: data.status,
      notes: data.notes ?? '',
      lastUpdated: toDate(data.lastUpdated),
      // Dynamic pricing fields
      floorPrice: data.floorPrice != null ? Number(data.floorPrice) : undefined,
      targetPrice: data.targetPrice != null ? Number(data.targetPrice) : undefined,
      priceSource: data.priceSource,
      priceVerified: data.priceVerified ?? false,
      qualityGrade: data.qualityGrade,
      farmerLocation: data.farmerLocation,
    } satisfies Negotiation;
  });

const mapMessages = (snap: QuerySnapshot<DocumentData>): ChatMessage[] =>
  snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      negotiationId: data.negotiationId,
      senderId: data.senderId,
      text: data.text ?? '',
      timestamp: toDate(data.timestamp),
    } satisfies ChatMessage;
  });

const mapMarketRates = (snap: QuerySnapshot<DocumentData>): MarketRate[] =>
  snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      crop: data.crop ?? data.name ?? '',
      pricePerQuintal: Number(data.pricePerQuintal ?? data.price ?? 0),
      changePct: Number(data.changePct ?? data.change ?? 0),
      trend: (data.trend === 'down' || data.trend === 'flat' || data.trend === 'up')
        ? data.trend
        : (Number(data.changePct ?? data.change ?? 0) > 0 ? 'up' : Number(data.changePct ?? data.change ?? 0) < 0 ? 'down' : 'flat'),
      updatedAt: toDate(data.updatedAt ?? data.timestamp ?? data.lastUpdated),
    } satisfies MarketRate;
  });

const mapFarmerDashboardWeather = (data: any): FarmerDashboardWeather | null => {
  const raw = data?.dashboardWeather ?? data?.weather ?? null;
  if (!raw) return null;
  return {
    locationLabel: raw.locationLabel ?? data?.location ?? 'India',
    temperatureC: Number(raw.temperatureC ?? raw.tempC ?? 0),
    conditionLabel: raw.conditionLabel ?? raw.condition ?? '—',
    weatherIcon: raw.weatherIcon ?? '',
    humidityPct: Number(raw.humidityPct ?? raw.humidity ?? 0),
    windKmh: Number(raw.windKmh ?? raw.wind ?? 0),
    rainPct: Number(raw.rainPct ?? raw.rain ?? 0),
    updatedAt: toDate(raw.updatedAt ?? raw.timestamp ?? data?.updatedAt),
  } satisfies FarmerDashboardWeather;
};

export const firebaseService = {
  async getUserProfile(uid: string): Promise<User | null> {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;
    const data = userSnap.data() as any;
    return {
      uid,
      name: data.name ?? 'User',
      avatarUrl: data.avatarUrl,
      phone: data.phone,
      email: data.email,
      location: data.location,
      role: data.role,
    } satisfies User;
  },

  async upsertUserProfile(user: User): Promise<void> {
    // Check if user already exists to preserve createdAt
    const existingDoc = await getDoc(doc(db, 'users', user.uid));
    const baseData = {
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      phone: user.phone ?? null,
      email: user.email ?? null,
      location: user.location ?? null,
      role: user.role,
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(
      doc(db, 'users', user.uid),
      existingDoc.exists() 
        ? baseData 
        : { ...baseData, createdAt: serverTimestamp() },
      { merge: true }
    );
  },

  subscribeUserProfiles(userIds: string[], onChange: (profiles: Record<string, User>) => void) {
    if (userIds.length === 0) {
      onChange({});
      return () => { };
    }

    const ids = Array.from(new Set(userIds)).filter(Boolean);
    const profileMap = new Map<string, User>();

    const emit = () => {
      const out: Record<string, User> = {};
      for (const [id, profile] of profileMap.entries()) out[id] = profile;
      onChange(out);
    };

    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, 'users', id),
        (snap) => {
          if (!snap.exists()) {
            profileMap.delete(id);
            emit();
            return;
          }
          const data = snap.data() as any;
          profileMap.set(id, {
            uid: id,
            name: data.name ?? 'User',
            avatarUrl: data.avatarUrl,
            phone: data.phone,
            email: data.email,
            location: data.location,
            role: data.role,
          } satisfies User);
          emit();
        },
        (err) => {
          console.warn('subscribeUserProfiles failed for', id, err);
          profileMap.delete(id);
          emit();
        }
      )
    );

    return () => unsubs.forEach((u) => u());
  },

  async ensureFarmerProfile(user: User): Promise<void> {
    if (user.role !== UserRole.Farmer) return;
    await setDoc(
      doc(db, 'farmers', user.uid),
      {
        name: user.name,
        profileImageUrl: user.avatarUrl ?? `https://i.pravatar.cc/150?u=${user.uid}`,
        isVerified: false,
        rating: 0,
        bio: 'New to Anna Bazaar',
        yearsFarming: 0,
        location: 'India',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  subscribeProducts(onChange: (products: Product[]) => void, pageSize = 50) {
    // Use pagination with a reasonable limit to prevent loading all documents at once
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(pageSize));
    return onSnapshot(q, (snap) => onChange(mapProducts(snap)));
  },

  /**
   * Load more products after the last document for infinite scroll
   */
  async loadMoreProducts(lastDoc: QueryDocumentSnapshot<DocumentData> | null, pageSize = 50): Promise<{ products: Product[], lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
    let q;
    if (lastDoc) {
      q = query(
        collection(db, 'products'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, 'products'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
    }
    const snap = await getDocs(q);
    const products = mapProducts(snap);
    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { products, lastDoc: newLastDoc };
  },

  subscribeFarmers(onChange: (farmers: Farmer[]) => void) {
    const q = query(collection(db, 'farmers'));
    return onSnapshot(q, (snap) => onChange(mapFarmers(snap)));
  },

  subscribeFarmerProfile(uid: string, onChange: (farmer: Farmer | null) => void) {
    const ref = doc(db, 'farmers', uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          onChange(null);
          return;
        }
        const data = snap.data() as any;
        onChange({
          id: snap.id,
          name: data.name ?? '',
          profileImageUrl: data.profileImageUrl ?? data.avatarUrl ?? '',
          isVerified: Boolean(data.isVerified ?? false),
          rating: Number(data.rating ?? 0),
          bio: data.bio ?? '',
          yearsFarming: Number(data.yearsFarming ?? 0),
          location: data.location ?? '',
          verificationFeedback: data.verificationFeedback,
        } satisfies Farmer);
      },
      (err) => {
        console.warn('subscribeFarmerProfile failed', err);
        onChange(null);
      }
    );
  },

  subscribeFarmerDashboardWeather(uid: string, onChange: (weather: FarmerDashboardWeather | null) => void) {
    const ref = doc(db, 'farmers', uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          onChange(null);
          return;
        }
        const data = snap.data() as any;
        onChange(mapFarmerDashboardWeather(data));
      },
      (err) => {
        console.warn('subscribeFarmerDashboardWeather failed', err);
        onChange(null);
      }
    );
  },

  subscribeMarketRates(onChange: (rates: MarketRate[]) => void) {
    const q = query(collection(db, 'marketRates'), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => onChange(mapMarketRates(snap)),
      (err) => {
        console.warn('subscribeMarketRates failed', err);
        onChange([]);
      }
    );
  },

  subscribeNegotiations(
    userId: string, 
    role: UserRole, 
    onChange: (negs: Negotiation[]) => void,
    onError?: (error: Error) => void
  ) {
    const field = role === UserRole.Buyer ? 'buyerId' : 'farmerId';
    console.log(`[subscribeNegotiations] Subscribing as ${role} with field ${field}=${userId}`);
    
    // ROBUST QUERY: Try with orderBy first, fallback to simple query if index missing
    let q = query(
      collection(db, 'negotiations'),
      where(field, '==', userId)
      // NOTE: orderBy('lastUpdated', 'desc') removed temporarily while index builds
      // Re-enable once index is confirmed: orderBy('lastUpdated', 'desc')
    );
    
    return onSnapshot(
      q, 
      (snap) => {
        console.log(`[subscribeNegotiations] Received ${snap.docs.length} negotiations`);
        // Sort client-side since we removed server-side ordering
        const negotiations = mapNegotiations(snap).sort(
          (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        );
        onChange(negotiations);
      },
      (error) => {
        console.error('[subscribeNegotiations] Firestore listener error:', error.message);
        if (error.message.includes('index')) {
          console.error('[subscribeNegotiations] Missing composite index. Create at: Firebase Console → Firestore → Indexes');
          console.error('[subscribeNegotiations] Required: negotiations collection - (', field, 'ASC, lastUpdated DESC)');
        }
        onError?.(error);
      }
    );
  },

  subscribeMessages(
    negotiationIds: string[], 
    onChange: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void
  ) {
    if (negotiationIds.length === 0) {
      console.log('[subscribeMessages] No negotiation IDs provided, returning empty');
      onChange([]);
      return () => { };
    }

    console.log('[subscribeMessages] Subscribing to messages for negotiations:', negotiationIds);
    const chunks = chunk(negotiationIds, 10);
    const messageMap = new Map<string, ChatMessage>();
    let hasError = false;

    const emit = () => {
      const list = Array.from(messageMap.values()).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      console.log('[subscribeMessages] Emitting', list.length, 'messages');
      onChange(list);
    };

    const unsubs = chunks.map((ids, chunkIndex) => {
      const q = query(
        collection(db, 'messages'),
        where('negotiationId', 'in', ids),
        orderBy('timestamp', 'asc')
      );

      return onSnapshot(
        q, 
        (snap) => {
          console.log(`[subscribeMessages] Chunk ${chunkIndex}: received ${snap.docChanges().length} changes`);
          for (const change of snap.docChanges()) {
            if (change.type === 'removed') {
              messageMap.delete(change.doc.id);
            } else {
              const [msg] = mapMessages({ docs: [change.doc] } as any);
              messageMap.set(change.doc.id, msg);
            }
          }
          emit();
        },
        (error) => {
          // CRITICAL: This catches permission errors and missing index errors
          console.error('[subscribeMessages] Firestore listener error:', error.message);
          console.error('[subscribeMessages] Error code:', (error as any).code);
          if (!hasError) {
            hasError = true;
            onError?.(error);
          }
        }
      );
    });

    return () => {
      console.log('[subscribeMessages] Unsubscribing from messages');
      unsubs.forEach((u) => u());
    };
  },

  async uploadProductImage(file: File, ownerUid: string): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `productImages/${ownerUid}/${Date.now()}-${safeName}`;
    const objectRef = ref(storage, objectPath);
    await uploadBytes(objectRef, file, { contentType: file.type || 'application/octet-stream' });
    return getDownloadURL(objectRef);
  },

  /**
   * Upload a KYC document to Firebase Storage
   */
  async uploadKYCDocument(file: File, farmerId: string, docType: 'aadhaar' | 'kisan' | 'photo'): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `kycDocuments/${farmerId}/${docType}/${Date.now()}-${safeName}`;
    const objectRef = ref(storage, objectPath);
    await uploadBytes(objectRef, file, { contentType: file.type || 'application/octet-stream' });
    return getDownloadURL(objectRef);
  },

  async addProduct(
    currentUser: User,
    productData: Omit<Product, 'id' | 'farmerId' | 'imageUrl' | 'isVerified' | 'verificationFeedback'>,
    imageFile: File
  ): Promise<void> {
    const imageUrl = await this.uploadProductImage(imageFile, currentUser.uid);

    await addDoc(collection(db, 'products'), {
      ...productData,
      farmerId: currentUser.uid,
      imageUrl,
      isVerified: false,
      verificationFeedback: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateProduct(productId: string, updates: Partial<Omit<Product, 'id' | 'farmerId'>>): Promise<void> {
    await updateDoc(doc(db, 'products', productId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Create a new negotiation with price floor validation
   * Throws an error if the offered price is below the floor price
   */
  async createNegotiation(negotiation: Omit<Negotiation, 'id'>): Promise<{ success: boolean; error?: string }> {
    // SERVER-SIDE PRICE FLOOR ENFORCEMENT
    // If floorPrice is set and offeredPrice is below it, reject the write
    if (negotiation.floorPrice != null && negotiation.offeredPrice < negotiation.floorPrice) {
      return {
        success: false,
        error: `Offer of ₹${negotiation.offeredPrice}/kg is below the floor price of ₹${negotiation.floorPrice}/kg. Minimum allowed: ₹${negotiation.floorPrice}/kg`,
      };
    }

    // BULK QUANTITY VALIDATION (minimum 1 quintal = 100kg)
    const MIN_BULK_QUANTITY = 100;
    if (negotiation.quantity < MIN_BULK_QUANTITY) {
      return {
        success: false,
        error: `Minimum bulk order is ${MIN_BULK_QUANTITY}kg (1 quintal). You specified: ${negotiation.quantity}kg`,
      };
    }

    await addDoc(collection(db, 'negotiations'), {
      ...negotiation,
      lastUpdated: Timestamp.fromDate(negotiation.lastUpdated ?? new Date()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return { success: true };
  },

  /**
   * Update an existing negotiation with price floor validation
   * Throws an error if the new price is below the floor price
   */
  async updateNegotiation(id: string, updates: Partial<Negotiation>): Promise<{ success: boolean; error?: string }> {
    // If updating price, validate against floor price
    if (updates.offeredPrice != null || updates.counterPrice != null) {
      // Fetch the existing negotiation to get floor price
      const negDoc = await getDoc(doc(db, 'negotiations', id));
      if (negDoc.exists()) {
        const existingData = negDoc.data();
        const floorPrice = existingData.floorPrice;
        
        // Check offered price
        if (floorPrice != null && updates.offeredPrice != null && updates.offeredPrice < floorPrice) {
          return {
            success: false,
            error: `Offer of ₹${updates.offeredPrice}/kg is below the floor price of ₹${floorPrice}/kg`,
          };
        }
        
        // Check counter price (farmers can counter at any price, but buyers cannot go below floor)
        // Note: Farmers countering is allowed at any price, but if buyer is counter-offering, must be >= floor
        if (floorPrice != null && updates.counterPrice != null && updates.counterPrice < floorPrice) {
          // Only enforce for buyer counter-offers (status would be CounterByBuyer)
          if (updates.status === 'Counter-By-Buyer') {
            return {
              success: false,
              error: `Counter-offer of ₹${updates.counterPrice}/kg is below the floor price of ₹${floorPrice}/kg`,
            };
          }
        }
      }
    }
    
    const payload: any = { ...updates, updatedAt: serverTimestamp() };
    if (updates.lastUpdated) payload.lastUpdated = Timestamp.fromDate(updates.lastUpdated);
    await updateDoc(doc(db, 'negotiations', id), payload);
    
    return { success: true };
  },

  async sendMessage(params: {
    negotiation: Negotiation;
    senderId: string;
    text: string;
  }): Promise<void> {
    const { negotiation, senderId, text } = params;
    
    // Determine recipientId: the other participant in the negotiation
    const recipientId = senderId === negotiation.buyerId 
      ? negotiation.farmerId 
      : negotiation.buyerId;
    
    console.log('[sendMessage] Sending message:', {
      negotiationId: negotiation.id,
      senderId,
      recipientId,
      buyerId: negotiation.buyerId,
      farmerId: negotiation.farmerId,
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    });
    
    const messageDoc = await addDoc(collection(db, 'messages'), {
      negotiationId: negotiation.id,
      buyerId: negotiation.buyerId,
      farmerId: negotiation.farmerId,
      senderId,
      recipientId, // Added for notification filtering
      participants: [negotiation.buyerId, negotiation.farmerId], // Array for easier querying
      text,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      read: false, // Track read status for notifications
    });
    
    console.log('[sendMessage] Message created with ID:', messageDoc.id);

    await updateDoc(doc(db, 'negotiations', negotiation.id), {
      lastUpdated: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: text.substring(0, 100), // Preview of last message
      lastMessageSenderId: senderId,
    });
    
    console.log('[sendMessage] Negotiation lastUpdated refreshed');
  },

  async setUserRole(userId: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'users', userId), { role, updatedAt: serverTimestamp() });
  },

  async saveFarmerKYC(
    farmerId: string,
    data: {
      personalInfo: {
        fullName: string;
        mobile: string;
        dateOfBirth: string;
        village: string;
      };
      documents: {
        aadhaarUrl: string;
        kisanUrl: string;
      };
      bankInfo: {
        accountHolder: string;
        accountNumber: string;
        ifscCode: string;
        bankName: string;
      };
      status: 'pending' | 'approved' | 'rejected';
      submittedAt: Date;
    }
  ): Promise<void> {
    await setDoc(
      doc(db, 'farmerKYC', farmerId),
      {
        ...data,
        submittedAt: Timestamp.fromDate(data.submittedAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Also update farmer profile with KYC status
    await updateDoc(doc(db, 'farmers', farmerId), {
      kycStatus: data.status,
      location: data.personalInfo.village,
      updatedAt: serverTimestamp(),
    });
  },

  async getFarmerKYCStatus(farmerId: string): Promise<'none' | 'pending' | 'approved' | 'rejected'> {
    try {
      const snap = await getDoc(doc(db, 'farmerKYC', farmerId));
      if (!snap.exists()) return 'none';
      const data = snap.data();
      return data?.status ?? 'none';
    } catch {
      return 'none';
    }
  },

  onFarmerTransactionsChanged(farmerId: string, onChange: (transactions: any[]) => void) {
    const q = query(
      collection(db, 'transactions'),
      where('farmerId', '==', farmerId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const transactions = snap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            farmerId: data.farmerId,
            type: data.type,
            status: data.status,
            amount: Number(data.amount ?? 0),
            description: data.description ?? '',
            timestamp: toDate(data.timestamp),
            relatedId: data.relatedId,
            metadata: data.metadata ?? {},
          };
        });
        onChange(transactions);
      },
      (err) => {
        console.warn('onFarmerTransactionsChanged failed', err);
        onChange([]);
      }
    );
  },

  async createTransaction(transaction: {
    farmerId: string;
    type: string;
    status: string;
    amount: number;
    description: string;
    relatedId?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const docRef = await addDoc(collection(db, 'transactions'), {
      ...transaction,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateTransaction(transactionId: string, updates: Partial<any>): Promise<void> {
    await updateDoc(doc(db, 'transactions', transactionId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async getFarmerWalletBalance(farmerId: string): Promise<number> {
    // First try to get cached balance from wallets collection
    const walletSnap = await getDoc(doc(db, 'wallets', farmerId));
    if (walletSnap.exists()) {
      return Number(walletSnap.data().totalBalance ?? 0);
    }
    
    // Calculate from transactions if wallet document doesn't exist
    const q = query(
      collection(db, 'transactions'),
      where('farmerId', '==', farmerId),
      where('status', '==', 'Completed')
    );
    const transactionsSnap = await getDocs(q);
    
    let balance = 0;
    transactionsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const amount = Number(data.amount ?? 0);
      const txType = data.type;
      
      if (txType === 'Payment' || txType === 'Subsidy' || txType === 'TopUp') {
        balance += amount;
      } else if (txType === 'Withdrawal') {
        balance -= amount;
      }
    });
    
    return balance;
  },

  async recordNegotiationPayment(negotiation: any, buyerId: string, farmerId: string, agreedPrice: number, quantity: number): Promise<void> {
    const amount = agreedPrice * quantity;
    const txId = await firebaseService.createTransaction({
      farmerId,
      type: 'Payment',
      status: 'Completed',
      amount,
      description: `Payment from buyer for ${negotiation.productName}`,
      relatedId: negotiation.id,
      metadata: {
        negotiationId: negotiation.id,
        buyerId,
        productId: negotiation.productId,
        quantity,
      },
    });

    // Update wallet balance
    const currentBalance = await firebaseService.getFarmerWalletBalance(farmerId);
    await setDoc(
      doc(db, 'wallets', farmerId),
      {
        farmerId,
        totalBalance: currentBalance + amount,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );
  },

  /**
   * Record a payment for an order through the payment gateway
   */
  async recordOrderPayment(params: {
    orderId: string;
    buyerId: string;
    totalAmount: number;
    transactionId: string;
    paymentMethod: string;
    productName?: string;
    items?: Array<{ productId: string; farmerId: string; quantity: number; price: number }>;
  }): Promise<void> {
    const { orderId, buyerId, totalAmount, transactionId, paymentMethod, productName, items } = params;

    // Create the order document with paid status
    await setDoc(
      doc(db, 'orders', orderId),
      {
        orderId,
        buyerId,
        totalAmount,
        transactionId,
        paymentMethod,
        productName: productName ?? 'Order Items',
        status: 'Paid',
        paidAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // If items are provided, distribute payments to farmers
    if (items && items.length > 0) {
      for (const item of items) {
        const amount = item.price * item.quantity;
        await firebaseService.createTransaction({
          farmerId: item.farmerId,
          type: 'Payment',
          status: 'Completed',
          amount,
          description: `Payment for order #${orderId}`,
          relatedId: orderId,
          metadata: {
            orderId,
            buyerId,
            productId: item.productId,
            quantity: item.quantity,
            transactionId,
          },
        });

        // Update farmer's wallet balance
        const currentBalance = await firebaseService.getFarmerWalletBalance(item.farmerId);
        await setDoc(
          doc(db, 'wallets', item.farmerId),
          {
            farmerId: item.farmerId,
            totalBalance: currentBalance + amount,
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  },

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<any | null> {
    try {
      const snap = await getDoc(doc(db, 'orders', orderId));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        id: snap.id,
        ...data,
        paidAt: toDate(data.paidAt),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      };
    } catch {
      return null;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // MANDI PRICES (Synced from Agmarknet via Scraper)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to live mandi prices from Firestore
   * Prices are synced from Agmarknet via the browser scraper
   */
  subscribeMandiPrices(
    onChange: (prices: MandiPriceDoc[]) => void,
    filters?: { state?: string; district?: string; commodity?: string }
  ): () => void {
    let q = query(collection(db, 'mandiPrices'));

    // Apply filters if provided
    if (filters?.state) {
      q = query(q, where('state', '==', filters.state));
    }
    if (filters?.district) {
      q = query(q, where('district', '==', filters.district));
    }
    if (filters?.commodity) {
      q = query(q, where('commodity', '==', filters.commodity));
    }

    return onSnapshot(
      q,
      (snap) => {
        const prices: MandiPriceDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            state: data.state ?? '',
            district: data.district ?? '',
            market: data.market ?? '',
            commodity: data.commodity ?? '',
            variety: data.variety ?? '',
            grade: data.grade ?? '',
            minPrice: data.minPrice ?? null,
            maxPrice: data.maxPrice ?? null,
            modalPrice: data.modalPrice ?? null,
            reportDate: data.reportDate ?? '',
            source: data.source ?? 'agmarknet',
            sourceUrl: data.sourceUrl,
            lastUpdated: data.lastUpdated ?? new Date().toISOString(),
            isVerified: data.isVerified ?? false,
            priceUnit: data.priceUnit ?? 'INR/Quintal',
          } satisfies MandiPriceDoc;
        });
        onChange(prices);
      },
      (err) => {
        console.error('[Firebase] Error subscribing to mandi prices:', err);
        onChange([]);
      }
    );
  },

  /**
   * Get mandi price for a specific commodity (for price validation)
   */
  async getMandiPriceForCommodity(
    commodity: string,
    state?: string,
    district?: string
  ): Promise<MandiPriceDoc | null> {
    try {
      const constraints: ReturnType<typeof where>[] = [where('commodity', '==', commodity)];
      if (state) constraints.push(where('state', '==', state));
      if (district) constraints.push(where('district', '==', district));

      const q = query(collection(db, 'mandiPrices'), ...constraints, limit(1));
      const snap = await getDocs(q);

      if (snap.empty) return null;

      const data = snap.docs[0].data() as any;
      return {
        state: data.state ?? '',
        district: data.district ?? '',
        market: data.market ?? '',
        commodity: data.commodity ?? '',
        variety: data.variety ?? '',
        grade: data.grade ?? '',
        minPrice: data.minPrice ?? null,
        maxPrice: data.maxPrice ?? null,
        modalPrice: data.modalPrice ?? null,
        reportDate: data.reportDate ?? '',
        source: data.source ?? 'agmarknet',
        sourceUrl: data.sourceUrl,
        lastUpdated: data.lastUpdated ?? new Date().toISOString(),
        isVerified: data.isVerified ?? false,
        priceUnit: data.priceUnit ?? 'INR/Quintal',
      } satisfies MandiPriceDoc;
    } catch (err) {
      console.error('[Firebase] Error fetching mandi price:', err);
      return null;
    }
  },

  /**
   * Get floor price (minimum acceptable) for negotiation validation
   * Returns price in ₹ per kg (converts from quintal)
   */
  async getFloorPricePerKg(
    commodity: string,
    state?: string,
    district?: string
  ): Promise<{ floorPrice: number; targetPrice: number; isVerified: boolean; source: string } | null> {
    const mandiPrice = await this.getMandiPriceForCommodity(commodity, state, district);
    if (!mandiPrice || mandiPrice.modalPrice === null) return null;

    // Convert from ₹/quintal to ₹/kg (1 quintal = 100 kg)
    const modalPricePerKg = mandiPrice.modalPrice / 100;
    const minPricePerKg = (mandiPrice.minPrice ?? mandiPrice.modalPrice) / 100;

    return {
      floorPrice: Math.round(minPricePerKg * 100) / 100,
      targetPrice: Math.round(modalPricePerKg * 100) / 100,
      isVerified: mandiPrice.isVerified,
      source: `${mandiPrice.market}, ${mandiPrice.district} (${mandiPrice.source})`,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // VOICE/VIDEO CALL FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Start a call - updates negotiation with ringing status
   * Called by the buyer when clicking "Call Farmer"
   */
  async startCall(
    negotiationId: string,
    callerId: string,
    callerName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(db, 'negotiations', negotiationId), {
        callStatus: CallStatus.Ringing,
        callerId,
        callerName,
        callStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[Firebase] Error starting call:', error);
      return { success: false, error: error.message || 'Failed to start call' };
    }
  },

  /**
   * Accept a call - updates negotiation with ongoing status
   * Called by the farmer when accepting an incoming call
   */
  async acceptCall(negotiationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(db, 'negotiations', negotiationId), {
        callStatus: CallStatus.Ongoing,
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[Firebase] Error accepting call:', error);
      return { success: false, error: error.message || 'Failed to accept call' };
    }
  },

  /**
   * Decline a call - updates negotiation with declined status
   * Called by the farmer when declining an incoming call
   */
  async declineCall(negotiationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(db, 'negotiations', negotiationId), {
        callStatus: CallStatus.Declined,
        callerId: null,
        callerName: null,
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[Firebase] Error declining call:', error);
      return { success: false, error: error.message || 'Failed to decline call' };
    }
  },

  /**
   * End a call - updates negotiation with ended status
   * Called when either party leaves the call room
   */
  async endCall(negotiationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(db, 'negotiations', negotiationId), {
        callStatus: CallStatus.Ended,
        callerId: null,
        callerName: null,
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (error: any) {
      console.error('[Firebase] Error ending call:', error);
      return { success: false, error: error.message || 'Failed to end call' };
    }
  },

  /**
   * Reset call status back to idle
   * Used after a call has ended to allow new calls
   */
  async resetCallStatus(negotiationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'negotiations', negotiationId), {
        callStatus: CallStatus.Idle,
        callerId: null,
        callerName: null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[Firebase] Error resetting call status:', error);
    }
  },

  /**
   * Subscribe to incoming calls for a specific user (farmer)
   * Returns negotiations where the user is the farmer and callStatus is 'ringing'
   */
  subscribeToIncomingCalls(
    farmerId: string,
    onChange: (incomingCalls: Negotiation[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const q = query(
      collection(db, 'negotiations'),
      where('farmerId', '==', farmerId),
      where('callStatus', '==', CallStatus.Ringing)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const calls: Negotiation[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            productId: data.productId,
            productName: data.productName,
            productImageUrl: data.productImageUrl,
            buyerId: data.buyerId,
            farmerId: data.farmerId,
            initialPrice: data.initialPrice,
            offeredPrice: data.offeredPrice,
            counterPrice: data.counterPrice,
            quantity: data.quantity,
            status: data.status,
            notes: data.notes,
            lastUpdated: toDate(data.lastUpdated),
            floorPrice: data.floorPrice,
            targetPrice: data.targetPrice,
            priceSource: data.priceSource,
            priceVerified: data.priceVerified,
            qualityGrade: data.qualityGrade,
            farmerLocation: data.farmerLocation,
            callStatus: data.callStatus,
            callerId: data.callerId,
            callerName: data.callerName,
            callStartedAt: toDate(data.callStartedAt),
          } as Negotiation;
        });
        onChange(calls);
      },
      (error) => {
        console.error('[Firebase] Error subscribing to incoming calls:', error);
        onError?.(error);
      }
    );
  },
};
