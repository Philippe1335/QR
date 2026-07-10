// Menu du restaurant de démo. En production, chaque restaurant pousse son
// menu via l'API ou une synchro POS ; ici il est défini en dur pour le MVP.
// `photo` est un emoji placeholder en attendant de vraies photos.

const MENU = [
  {
    category: 'Entrées',
    items: [
      { name: 'Soupe du Jour', price: 6.5, photo: '🍲', description: 'Préparée chaque matin avec les légumes du marché' },
      { name: 'Bruschetta', price: 7.0, photo: '🍅', description: 'Pain grillé, tomates fraîches, basilic et huile d’olive' },
      { name: 'Planche Charcuterie', price: 14.5, photo: '🧀', description: 'Sélection de charcuteries et fromages locaux' },
      { name: 'Calmars Frits', price: 11.0, photo: '🦑', description: 'Servis avec aïoli citronné' }
    ]
  },
  {
    category: 'Plats',
    items: [
      { name: 'Burger Classique', price: 12.0, photo: '🍔', description: 'Bœuf 100%, cheddar, laitue, tomate, frites maison' },
      { name: 'Burger Gourmet', price: 16.5, photo: '🍔', description: 'Bœuf Angus, brie fondant, oignons caramélisés, bacon' },
      { name: 'Poulet Rôti', price: 18.0, photo: '🍗', description: 'Demi-poulet fermier, jus corsé, légumes de saison' },
      { name: 'Poisson du Jour', price: 22.0, photo: '🐟', description: 'Arrivage frais, selon la pêche du matin' },
      { name: 'Pâtes Carbonara', price: 15.0, photo: '🍝', description: 'Guanciale, pecorino, œuf fermier — la vraie recette' },
      { name: 'Pizza Margherita', price: 14.0, photo: '🍕', description: 'Tomate San Marzano, mozzarella di bufala, basilic' },
      { name: 'Salade César', price: 13.0, photo: '🥗', description: 'Romaine, poulet grillé, parmesan, croûtons à l’ail' },
      { name: 'Steak Frites', price: 24.0, photo: '🥩', description: 'Bavette 250 g, beurre maître d’hôtel, frites maison' }
    ]
  },
  {
    category: 'Desserts',
    items: [
      { name: 'Tiramisu', price: 7.5, photo: '🍰', description: 'Mascarpone, café espresso, cacao — fait maison' },
      { name: 'Crème Brûlée', price: 7.5, photo: '🍮', description: 'À la vanille de Madagascar, croûte caramélisée' },
      { name: 'Fondant au Chocolat', price: 8.0, photo: '🍫', description: 'Cœur coulant 70% cacao, glace vanille' },
      { name: 'Salade de Fruits', price: 6.5, photo: '🍓', description: 'Fruits frais de saison, sirop léger à la menthe' }
    ]
  },
  {
    category: 'Boissons',
    items: [
      { name: 'Bière Pression', price: 6.0, photo: '🍺', description: 'Blonde locale, 473 ml' },
      { name: 'Verre de Vin', price: 8.0, photo: '🍷', description: 'Rouge ou blanc, sélection du sommelier' },
      { name: 'Cocktail Maison', price: 11.0, photo: '🍹', description: 'Création du barman, demandez la carte' },
      { name: 'Limonade Artisanale', price: 4.5, photo: '🍋', description: 'Pressée minute, menthe fraîche' },
      { name: 'Café', price: 3.0, photo: '☕', description: 'Espresso, allongé ou latte' },
      { name: 'Eau Pétillante', price: 3.5, photo: '💧', description: 'Bouteille 750 ml' }
    ]
  }
];

module.exports = { MENU };
