#!/bin/bash

# Définir les dossiers
DOCS_DIR="plateform/docs"
CODE_DIR="plateform/code"
BRANCH_NAME="move-code-from-txt"

# Vérifier si le répertoire existe
if [ ! -d "$DOCS_DIR" ]; then
  echo "Erreur : le dossier $DOCS_DIR n'existe pas."
  exit 1
fi

# Créer une nouvelle branche Git
git checkout -b "$BRANCH_NAME"

# Définir les motifs de recherche pour détecter du code
PATTERNS='function|class|import|include|def|var|let|const|return|if|else|elif|for|while|public|private|protected|static|void|int|char|string|boolean|async|await'

# Scanner et déplacer les fichiers contenant du code
for file in "$DOCS_DIR"/*.txt; do
  if grep -qE "$PATTERNS" "$file"; then
    # Déterminer la nouvelle extension (par défaut .tsx)
    EXT=".tsx"
    [[ $(basename "$file") == *"api"* ]] && EXT=".rs"
    [[ $(basename "$file") == *"script"* ]] && EXT=".js"

    # Nouveau nom de fichier
    NEW_FILE="$CODE_DIR/$(basename "${file%.txt}$EXT")"

    # Déplacer le fichier
    mv "$file" "$NEW_FILE"
    echo "Déplacé : $file → $NEW_FILE"

    # Ajouter au suivi Git
    git add "$NEW_FILE"
    git rm "$file"
  fi
done

# Commit des modifications
git commit -m "Déplacement automatique des fichiers contenant du code de docs/ vers code/"

# Pousser la nouvelle branche sur GitHub
git push origin "$BRANCH_NAME"

# Afficher le lien pour la PR
echo "Branche créée : $BRANCH_NAME"
echo "Créez une pull request ici : https://github.com/Abdelmalek33300/Etika-Blockchain-Project/pull/new/$BRANCH_NAME"
