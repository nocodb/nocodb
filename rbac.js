const AccessControl = require('accesscontrol');

let grantArray = [
    { role: 'reader', resource: 'post', action: 'read:any', attributes: '*, !id' },
    
    { role: 'writer', resource: 'post', action: 'create:own', attributes: '*' },
    { role: 'writer', resource: 'post', action: 'read:any', attributes: '*' },
    { role: 'writer', resource: 'post', action: 'update:own', attributes: '*' },
    { role: 'writer', resource: 'post', action: 'delete:own', attributes: '*' },

    { role: 'editor', resource: 'post', action: 'create:any', attributes: '*' },
    { role: 'editor', resource: 'post', action: 'read:any', attributes: '*' },
    { role: 'editor', resource: 'post', action: 'update:any', attributes: '*' },
    { role: 'editor', resource: 'post', action: 'delete:any', attributes: '*' },
];
  
const ac = new AccessControl(grantArray);

const per0 = ac.can('reader').readAny('post');
console.log(per0.granted);    // —> true

const per1 = ac.can('editor').updateAny('post');
console.log(per1.granted);    // —> true