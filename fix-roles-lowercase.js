// Script to fix role case mismatch - convert all roles to lowercase
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixRoles() {
    console.log('🔧 Fixing role case mismatch...');
    
    // Mapping of uppercase roles to lowercase
    const roleMapping = {
        'CEO': 'ceo',
        'ASSISTANT_CEO': 'director',
        'MANAGER': 'manager',
        'STAFF': 'staff',
        'MARKETING': 'marketing',
        'FINANCE': 'finance',
        'COMMERCIAL': 'commercial',
        'OPERATIONS': 'operations',
        'PROCUREMENT': 'procurement'
    };
    
    try {
        // Get all users
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true }
        });
        
        console.log(`\nFound ${users.length} users:`);
        
        for (const user of users) {
            const currentRole = user.role;
            const newRole = roleMapping[currentRole] || currentRole.toLowerCase();
            
            if (currentRole !== newRole) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { role: newRole }
                });
                console.log(`✓ Updated ${user.name || user.email}: "${currentRole}" → "${newRole}"`);
            } else {
                console.log(`  ${user.name || user.email}: "${currentRole}" (already lowercase)`);
            }
        }
        
        console.log('\n✅ All roles updated successfully!');
        
    } catch (error) {
        console.error('❌ Error updating roles:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixRoles();
