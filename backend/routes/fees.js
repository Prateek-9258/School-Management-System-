const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');
const feeController = require('../controllers/feeController'); // Import controller

// Unify all routes to use controller for consistency
router.get('/stats',             feeController.getFeeStats);
router.get('/pending',           feeController.getPendingFees);
router.get('/student/:studentId', feeController.getStudentFees);
router.get('/',                  feeController.getAllFees);
router.post('/',                 feeController.addFee);
router.post('/bulk-generate',    feeController.bulkGenerateFees);
router.put('/:id',               feeController.updateFeeStatus);
router.delete('/:id',            feeController.deleteFee);

module.exports = router;
