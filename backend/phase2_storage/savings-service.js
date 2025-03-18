// savings-service.js - Service pour l'épargne (Phase 2)
import express from 'express';
const router = express.Router();

/**
 * @route POST /api/savings/delegate
 * @desc Déléguer une épargne
 */
router.post('/api/savings/delegate', authenticateJWT, async (req, res) => {
    try {
        const result = await etikaService.setSavingsDelegation(req.body.delegateAddress);
        res.json({ success: true, result });
    } catch (error) {
        console.error("Erreur lors de la délégation d'épargne :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

/**
 * @route POST /api/savings/undelegate
 * @desc Annuler la délégation d'épargne
 */
router.post('/api/savings/undelegate', authenticateJWT, async (req, res) => {
    try {
        const result = await etikaService.removeSavingsDelegation();
        res.json({ success: true, result });
    } catch (error) {
        console.error("Erreur lors de l'annulation de délégation :", error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

export default router;
