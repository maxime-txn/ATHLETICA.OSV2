
export const downloadCSV = async (filename: string, headers: string[], rows: (string | number)[][]) => {
  // 1. Construction du contenu CSV
  // Ajout du BOM (Byte Order Mark) \uFEFF pour forcer Excel à lire l'UTF-8 correctement (accents)
  const csvContent = "\uFEFF" + [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Échapper les guillemets et entourer de guillemets si nécessaire (pour les textes avec virgules)
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
  ].join('\n');

  // 2. Création du Blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const file = new File([blob], filename, { type: 'text/csv' });

  // 3. Tentative de Partage Natif (Mobile)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Export Athletica OS',
        text: 'Voici mes données d\'entraînement brutes.'
      });
      return;
    } catch (error) {
      console.warn('Partage natif annulé ou échoué, repli sur le téléchargement classique.', error);
    }
  }

  // 4. Fallback : Téléchargement Classique (Desktop / Android ancien)
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helpers de formatage pour les exports
export const formatDateISO = (dateStr: string) => dateStr; // Garder YYYY-MM-DD pour le tri Excel facile
export const formatNumber = (num?: number) => num !== undefined ? num.toString().replace('.', '.') : ''; // Point pour compatibilité universelle
