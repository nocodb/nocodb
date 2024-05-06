***

titel: 'Overzicht'
beschrijving: 'Leer meer over de verschillende methoden die beschikbaar zijn voor authenticatie met NocoDB.'
Tags: \['SSO', 'Overzicht']
trefwoorden: \['SSO', 'Overzicht', 'Authenticatie', 'E-mail', 'Wachtwoord', 'SAML', 'OIDC']
-------------------------------------------------------------------------------------------

Deze sectie geeft een overzicht van de verschillende mechanismen die beschikbaar zijn voor authenticatie in NocoDB.

# E-mail en wachtwoord gebaseerd

Dit is het standaard op formulieren gebaseerde authenticatiemechanisme dat beschikbaar is in NocoDB. Gebruikers kunnen zich aanmelden met e-mailadres en wachtwoord en vervolgens inloggen met dezelfde inloggegevens.

# Eenmalige aanmelding (SSO)

:::info
Gelieve te bereiken[**out to sales**](https://calendly.com/nocodb)voor SSO-toegang.
:::

SSO is een sessie- en gebruikersauthenticatieservice waarmee een gebruiker één set inloggegevens kan gebruiken om toegang te krijgen tot meerdere applicaties. De service authenticeert de eindgebruiker voor alle applicaties waarvoor de gebruiker rechten heeft gekregen en elimineert verdere prompts wanneer de gebruiker tijdens dezelfde sessie van applicatie wisselt.

SSO-functionaliteit wordt bereikt door een verbinding tot stand te brengen met een identiteitsprovider (IdP), die dient als opslagplaats voor het beheren van de digitale identiteit van gebruikers binnen het digitale of cloudgebaseerde ecosysteem. Door het gebruik van protocollen zoals de Security Assertion Markup Language (SAML 2.0), zoals in het geval van NocoDB, faciliteert SSO de veilige uitwisseling van authenticatiegegevens tussen de identiteitsprovider en de serviceproviders.

### Google OAuth

Google OAuth, een afkorting van Open Authorization, is een veelgebruikt en gestandaardiseerd protocol dat veilige authenticatie- en autorisatieprocessen mogelijk maakt, vooral in de context van web- en mobiele applicaties. OAuth is ontwikkeld door Google en stelt gebruikers in staat applicaties van derden beperkte toegang tot hun bronnen te verlenen zonder hun inloggegevens vrij te geven. Dit autorisatieframework is gebaseerd op op tokens gebaseerde authenticatie, waarbij gebruikers kunnen inloggen met hun Google-inloggegevens, en ontwikkelaars een toegangstoken kunnen verkrijgen om namens de gebruiker met Google API's te communiceren.

Volg de details in het artikel om mee te integreren [Google OAuth](google-oauth)

### Security Assertion Markup Language (SAML)

De Security Assertion Markup Language (SAML) is een cruciaal protocol op het gebied van veilige authenticatie- en autorisatieprocessen. SAML is ontwikkeld om Single Sign-On (SSO)-functionaliteit mogelijk te maken en vergemakkelijkt de uitwisseling van authenticatie- en autorisatiegegevens tussen een identiteitsprovider (IdP) en een serviceprovider (SP). Dit op XML-gebaseerde protocol zorgt voor de veilige overdracht van gebruikersidentiteitsinformatie, waardoor individuen toegang krijgen tot meerdere applicaties en diensten met één enkele set inloggegevens. SAML werkt op basis van een vertrouwensmodel, waarbij de identiteitsprovider de identiteit van de gebruiker aan de serviceprovider bevestigt, die op zijn beurt toegang verleent of weigert op basis van de verstrekte beweringen.

[//]: # "This robust framework is widely employed in various industries and platforms, contributing to the seamless and secure integration of disparate systems and applications in the digital landscape. SAML adoption is particularly evident in cloud-based services, enterprise applications, and other environments where a unified and secure authentication process is paramount."

Volg de details in het onderstaande artikel om te integreren met verschillende populaire SAML-providers.

1. [Oké](SAML-SSO/okta)
2. [Auth0](SAML-SSO/auth0)
3. [Ping-identiteit](SAML-SSO/ping-identity)
4. [Actieve map](SAML-SSO/azure-ad)
5. [Sleutelmantels](SAML-SSO/keycloak)

### OpenID Connect (OIDC)

Het OpenID Connect (OIDC)-protocol is een moderne authenticatielaag die bovenop het OAuth 2.0-framework is gebouwd en is ontworpen om uitdagingen op het gebied van gebruikersauthenticatie en autorisatie in web- en mobiele applicaties aan te pakken. OIDC biedt een gestandaardiseerde en veilige manier voor applicaties om de identiteit van eindgebruikers te verifiëren. Door gebruik te maken van JSON Web Tokens (JWT's) maakt OIDC de uitwisseling van gebruikersidentiteitsinformatie mogelijk tussen de identiteitsprovider (IdP) en de serviceprovider, meestal een webapplicatie.

[//]: # "One of the key advantages of OIDC is its ability to enable Single Sign-On (SSO) capabilities, allowing users to authenticate once and access multiple applications seamlessly. OIDC also provides a standardized set of claims, such as user profile information, making it easier for developers to integrate identity management into their applications. Widely adopted in various industries, OIDC plays a crucial role in enhancing the security and user experience of authentication processes across diverse digital platforms."

Volg de details in het onderstaande artikel om te integreren met verschillende populaire OIDC-providers.

1. [Oké](OIDC-SSO/okta)
2. [Auth0](OIDC-SSO/auth0)
3. [Ping-identiteit](OIDC-SSO/ping-identity)
4. [Actieve map](OIDC-SSO/azure-ad)
5.
