import prisma from '../db/db.js';

export const getAlternatives = async (req, res) => {
  try {
    const { category } = req.query;

    const query = category ? { where: { category } } : {};
    
    const alternatives = await prisma.circularAlternative.findMany(query);
    
    res.json({
      message: 'Circular alternatives retrieved successfully',
      alternatives
    });
  } catch (error) {
    console.error('Error retrieving circular alternatives:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
