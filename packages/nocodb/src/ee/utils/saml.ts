import crypto from 'crypto';
import libxmljs from 'libxmljs';

// metadata parser - https://github.com/mikefowler/node-idp-metadata-parser/tree/master
export async function parseSamlMetadata(metadataXml, options: any = {}) {
  return new Promise((resolve) => {
    const { entityId, ssoBinding, sloBinding } = options;

    const doc = libxmljs.parseXml(metadataXml);
    const entityDescriptor = getEntityDescriptor(doc, entityId);
    const singleSignOnServiceUrl = getSingleSignonServiceUrl(
      entityDescriptor,
      ssoBinding,
    );
    const singleLogoutServiceUrl = getSingleLogoutServiceUrl(
      entityDescriptor,
      sloBinding,
    );
    const certificates = getCertificates(entityDescriptor);

    const metadata = {
      issuer: entityDescriptor.getAttribute('entityID').value(),
      entryPoint: singleSignOnServiceUrl,
      cert: certificates?.signing,
      encryption: certificates?.encryption,
      logoutUrl: singleLogoutServiceUrl,
    };

    resolve(metadata);
  });
}

const NAMESPACE = {
  md: 'urn:oasis:names:tc:SAML:2.0:metadata',
  NameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:*',
  saml: 'urn:oasis:names:tc:SAML:2.0:assertion',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
};

function getEntityDescriptorPath(entityId) {
  const path = '//md:EntityDescriptor';

  if (!entityId) {
    return path;
  }

  return `${path}[@entityID="${entityId}"]`;
}

export function getEntityDescriptor(doc, entityId) {
  if (!doc) return null;

  const path = getEntityDescriptorPath(entityId);
  return doc.get(path, NAMESPACE);
}

export function getIdpSsoDescriptor(doc) {
  if (!doc) return null;

  return doc.get('md:IDPSSODescriptor', NAMESPACE);
}

export function getIdpNameIdFormat(doc) {
  if (!doc) return null;

  const node = doc.get('md:IDPSSODescriptor/md:NameIDFormat', NAMESPACE);

  if (node) {
    return node.text();
  }

  return null;
}

function getSingleSignonServiceBinding(doc, bindingPriority) {
  const nodes = doc.find(
    'md:IDPSSODescriptor/md:SingleSignOnService/@Binding',
    NAMESPACE,
  );

  if (bindingPriority) {
    const bindings = nodes.map((node) => node.value());
    return bindingPriority.find((priority) => bindings.includes(priority));
  } else if (nodes.length > 0) {
    return nodes[0].value();
  }

  return null;
}

export function getSingleSignonServiceUrl(doc, bindingPriority) {
  const binding = getSingleSignonServiceBinding(doc, bindingPriority);

  if (!binding) return null;

  const node = doc.get(
    `md:IDPSSODescriptor/md:SingleSignOnService[@Binding="${binding}"]/@Location`,
    NAMESPACE,
  );

  if (node) {
    return node.value();
  }

  return null;
}

function getSingleLogoutServiceBinding(doc, bindingPriority) {
  const nodes = doc.find(
    'md:IDPSSODescriptor/md:SingleLogoutService/@Binding',
    NAMESPACE,
  );

  if (bindingPriority) {
    const bindings = nodes.map((node) => node.value());
    return bindingPriority.find((priority) => bindings.includes(priority));
  } else if (nodes.length > 0) {
    return nodes[0].value();
  }

  return null;
}

export function getSingleLogoutServiceUrl(doc, bindingPriority) {
  const binding = getSingleLogoutServiceBinding(doc, bindingPriority);

  if (!binding) return null;

  const node = doc.get(
    `md:IDPSSODescriptor/md:SingleLogoutService[@Binding="${binding}"]/@Location`,
    NAMESPACE,
  );

  if (node) {
    return node.value();
  }

  return null;
}

export function getAttributeNames(doc) {
  if (!doc) return null;

  const nodes = doc.find('md:IDPSSODescriptor/saml:Attribute/@Name', NAMESPACE);

  if (nodes) {
    return nodes.map((n) => n.value());
  }

  return null;
}

export function getCertificates(doc) {
  const signingNodes = doc.find(
    'md:IDPSSODescriptor/md:KeyDescriptor[not(contains(@use, "encryption"))]/ds:KeyInfo/ds:X509Data/ds:X509Certificate',
    NAMESPACE,
  );

  const encryptionNodes = doc.find(
    'md:IDPSSODescriptor/md:KeyDescriptor[not(contains(@use, "signing"))]/ds:KeyInfo/ds:X509Data/ds:X509Certificate',
    NAMESPACE,
  );

  let certs;

  if (signingNodes.length > 0 || encryptionNodes.length > 0) {
    certs = {
      signing: [],
      encryption: [],
    };

    if (signingNodes.length > 0) {
      signingNodes.forEach((node) => {
        certs.signing.push(node.text());
      });
    }

    if (encryptionNodes.length > 0) {
      encryptionNodes.forEach((node) => {
        certs.encryption.push(node.text());
      });
    }
  }

  return certs;
}

function getCertificateFingerprint(certificate, _) {
  if (!certificate) return null;

  const shasum = crypto.createHash('sha1');
  const der = Buffer.from(certificate, 'base64').toString('binary');
  shasum.update(der);

  return shasum.digest('hex');
}

export function getCertificateMetadata(certificates, fingerprintAlgorithm?) {
  if (!certificates) return null;

  const { signing: signingCerts, encryption: encryptionCerts } = certificates;

  const certCount = signingCerts.length + encryptionCerts.length;

  const hasTwoMatchingCerts =
    signingCerts.length === 1 &&
    encryptionCerts.length === 1 &&
    signingCerts[0] === encryptionCerts[0];

  if (certCount === 1 || hasTwoMatchingCerts) {
    const idpCert = signingCerts ? signingCerts[0] : encryptionCerts[0];
    const idpCertFingerprint = getCertificateFingerprint(
      idpCert,
      fingerprintAlgorithm,
    );

    return { idpCert, idpCertFingerprint };
  }

  return {
    idpCertMulti: certificates,
  };
}
