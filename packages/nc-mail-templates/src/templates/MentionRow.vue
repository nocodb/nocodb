<script lang="ts" setup>
import {defaultComponents} from "vue-extensible-mail";

const { Container } = defaultComponents;
</script>

<template>
  <HtmlWrapper>
    <Header />

    <Container>
      <div style="max-width: 400px">
        <h1
          style="
            font-size: 40px;
            font-weight: bold;
            color: #101015;
            margin-block: 64px;
          "
        >
          You have been mentioned.
        </h1>
        <p
          style="
            font-size: 14px;
            color: #1f293a;
            margin-block: 64px;
            padding-bottom: 24px;
            padding-top: 24px;
          "
        >
          <strong> <%= name %> </strong>
          has mentioned you in a record
          in the
          <strong> <%= table %> / <%= base %> </strong>.
        </p>

        <a href="<%= url %>" style="text-decoration: none">
          <div
            style="
              cursor: pointer;
              border-radius: 8px;
              background-color: #3366ff;
              border: none;
              color: white;
              padding-bottom: 15px;
              padding-top: 15px;
              max-width: 426px;
              width: 100%;
              margin-block: 64px;
              text-align: center;
            "
          >
            <span> View Record </span>
          </div>
        </a>

        <p
          style="
            color: #374151;
            font-size: 14px;
            padding-top: 24px;
            padding-bottom: 24px;
          "
        >
          NocoDB is solution for all your database needs.
        </p>
      </div>
      <Footer style="width: 100%" />
    </Container>
  </HtmlWrapper>
</template>
